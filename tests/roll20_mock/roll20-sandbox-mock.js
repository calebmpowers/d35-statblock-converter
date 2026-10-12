'use strict';

class Roll20Object {
    constructor(world, type, id, attrs) {
        this._world = world;
        this.id = id;
        this._attrs = Object.assign({}, attrs || {});
        this._attrs._id = id;
        this._attrs.id = id;
        this._attrs._type = type;
        this._attrs.type = type;

        if (type === 'graphic') {
            this._attrs._pageid = this._attrs.pageid;
            this._attrs._subtype = 'token';
            delete this._attrs.pageid;
        }

        if (this._attrs.characterid && !this._attrs._characterid) {
            this._attrs._characterid = this._attrs.characterid;
        }
        if (this._attrs._characterid && !this._attrs.characterid) {
            this._attrs.characterid = this._attrs._characterid;
        }
    }

    get(prop, callback) {
        const value = this._attrs[prop];
        const blob = (this._attrs._type === 'character' && ['bio', 'gmnotes', '_defaulttoken'].includes(prop)) ||
            (this._attrs._type === 'handout' && ['notes', 'gmnotes'].includes(prop));
        if (blob && typeof callback !== 'function') {
            throw new Error('Roll20 blob reads require a callback: ' + prop);
        }
        if (typeof callback === 'function') {
            if (!this._world.suspendBlobs) {
                this._world.setTimeout(() => callback(value === undefined ? '' : value), 1);
            }
            return undefined;
        }
        return value === undefined ? '' : value;
    }

    set(prop, value) {
        const changes = typeof prop === 'string' ? { [prop]: value } : prop || {};
        if (this._attrs._type === 'character' && ['defaulttoken', '_defaulttoken'].some((key) => key in changes)) {
            throw new Error('The saved default token is read-only; use setDefaultTokenForCharacter.');
        }
        if (this._world.hooks.beforeSet) { this._world.hooks.beforeSet(this, changes); }
        if (typeof prop === 'string') {
            this._attrs[prop] = value;
        } else {
            Object.assign(this._attrs, prop || {});
        }
        if (this._attrs.characterid && !this._attrs._characterid) {
            this._attrs._characterid = this._attrs.characterid;
        }
        if (this._attrs._characterid && !this._attrs.characterid) {
            this._attrs.characterid = this._attrs._characterid;
        }
        if (this._world.hooks.afterSet) { this._world.hooks.afterSet(this, changes); }
        return this;
    }

    setWithWorker(prop, value) {
        return this.set(prop, value);
    }

    remove() {
        if (this._world.hooks.beforeRemove && this._world.hooks.beforeRemove(this) === false) { return; }
        this._world.remove(this);
    }

    toJSON() {
        return Object.assign({}, this._attrs);
    }
}

function createRoll20Mock() {
    let nextId = 1;
    const objects = [];
    const handlers = {};
    const chat = [];
    const logs = [];
    const timers = new Map();
    let timerId = 0;
    let now = 0;

    function makeId() {
        return '-MOCK' + String(nextId++).padStart(8, '0');
    }

    function normalizeType(type) {
        return String(type || '').replace(/^_/, '');
    }

    function objectValue(obj, key) {
        if (key === 'id') {
            return obj.id;
        }
        if (key === '_id') {
            return obj.id;
        }
        if (key === 'type' || key === '_type') {
            return obj.get('_type');
        }
        return obj.get(key);
    }

    function matches(obj, attrs, options) {
        const caseInsensitive = options && options.caseInsensitive;
        return Object.keys(attrs || {}).every((key) => {
            let expected = attrs[key];
            let actual = objectValue(obj, key);
            if (caseInsensitive && typeof expected === 'string' && typeof actual === 'string') {
                expected = expected.toLowerCase();
                actual = actual.toLowerCase();
            }
            return actual === expected;
        });
    }

    const world = {
        objects,
        handlers,
        chat,
        logs,
        state: {},
        hooks: {},
        suspendBlobs: false,
        defaultCapture: 'normal',

        setTimeout(callback, delay) {
            const id = ++timerId;
            timers.set(id, { callback, at: now + (delay || 0) });
            return id;
        },

        clearTimeout(id) { timers.delete(id); },

        flush() {
            let steps = 0;
            while (timers.size) {
                if (++steps > 10000) { throw new Error('Mock callback queue did not settle.'); }
                const [id, timer] = Array.from(timers.entries()).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
                timers.delete(id);
                now = timer.at;
                timer.callback();
            }
        },

        createObj(type, attrs) {
            const normalized = normalizeType(type);
            if (normalized === 'graphic') {
                const readOnly = Object.keys(attrs || {}).find((key) => key.startsWith('_') ||
                    ['id', 'type', 'subtype', 'cardid'].includes(key));
                if (readOnly) { throw new Error('Read-only graphic create property: ' + readOnly); }
                if (!attrs || typeof attrs.pageid !== 'string' || !world.getObj('page', attrs.pageid)) {
                    throw new Error('Graphic creation requires a valid pageid.');
                }
            }
            if (['character', 'handout'].includes(normalized) && ['bio', 'notes', 'gmnotes', '_defaulttoken', 'defaulttoken'].some((key) => key in (attrs || {}))) {
                throw new Error('Roll20 blob fields must be set after object creation.');
            }
            if (world.hooks.beforeCreate) { world.hooks.beforeCreate(normalized, attrs); }
            const obj = new Roll20Object(world, normalized, makeId(), attrs || {});
            objects.push(obj);
            if (world.hooks.afterCreate) { world.hooks.afterCreate(obj); }
            (handlers['add:' + normalized] || []).forEach((handler) => handler(obj));
            return obj;
        },

        getObj(type, id) {
            const normalized = normalizeType(type);
            return objects.find((obj) => obj.get('_type') === normalized && obj.id === id) || null;
        },

        findObjs(attrs, options) {
            return objects.filter((obj) => matches(obj, attrs || {}, options || {}));
        },

        filterObjs(callback) {
            return objects.filter(callback);
        },

        getAllObjs() {
            return objects.slice();
        },

        getAttrByName(characterId, name, valueType) {
            const attr = world.findObjs({
                _type: 'attribute',
                characterid: characterId,
                name
            })[0];
            return attr ? attr.get(valueType === 'max' ? 'max' : 'current') : undefined;
        },

        on(eventName, callback) {
            handlers[eventName] = handlers[eventName] || [];
            handlers[eventName].push(callback);
        },

        trigger(eventName, payload) {
            (handlers[eventName] || []).forEach((handler) => handler(payload));
        },

        sendChat(who, message, callback) {
            chat.push({ who, message });
            if (typeof callback === 'function') {
                callback([]);
            }
        },

        log(message) {
            logs.push(message);
        },

        playerIsGM(id) {
            return id === '-MOCKGM';
        },

        randomInteger(max) {
            return Math.max(1, Math.min(Number(max) || 1, 1));
        },

        Campaign() {
            return {
                get(prop) {
                    if (prop === 'playerpageid') {
                        return '-MOCKPAGE';
                    }
                    return '';
                }
            };
        },

        onSheetWorkerCompleted(callback) {
            if (typeof callback === 'function') {
                world.setTimeout(callback, 1);
            }
        },

        setDefaultTokenForCharacter(character, token) {
            if (world.defaultCapture === 'throw') { throw new Error('Injected capture failure'); }
            if (world.defaultCapture === 'missing') { return; }
            const data = token.toJSON();
            if (world.defaultCapture === 'incorrect') { data.represents = '-WRONG'; }
            character._attrs._defaulttoken = JSON.stringify(data);
        },

        remove(obj) {
            const index = objects.indexOf(obj);
            if (index >= 0) {
                objects.splice(index, 1);
            }
        },

        globals() {
            return {
                state: world.state,
                setTimeout: world.setTimeout,
                clearTimeout: world.clearTimeout,
                createObj: world.createObj,
                getObj: world.getObj,
                findObjs: world.findObjs,
                filterObjs: world.filterObjs,
                getAllObjs: world.getAllObjs,
                getAttrByName: world.getAttrByName,
                on: world.on,
                sendChat: world.sendChat,
                log: world.log,
                playerIsGM: world.playerIsGM,
                randomInteger: world.randomInteger,
                Campaign: world.Campaign,
                onSheetWorkerCompleted: world.onSheetWorkerCompleted,
                setDefaultTokenForCharacter: world.setDefaultTokenForCharacter
            };
        }
    };

    objects.push(new Roll20Object(world, 'page', '-MOCKPAGE', { name: 'Mock tabletop' }));
    return world;
}

module.exports = {
    createRoll20Mock
};
