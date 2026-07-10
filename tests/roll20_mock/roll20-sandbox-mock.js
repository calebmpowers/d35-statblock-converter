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

        if (this._attrs.characterid && !this._attrs._characterid) {
            this._attrs._characterid = this._attrs.characterid;
        }
        if (this._attrs._characterid && !this._attrs.characterid) {
            this._attrs.characterid = this._attrs._characterid;
        }
    }

    get(prop, callback) {
        const value = this._attrs[prop];
        if (typeof callback === 'function') {
            callback(value === undefined ? '' : value);
            return undefined;
        }
        return value === undefined ? '' : value;
    }

    set(prop, value) {
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
        return this;
    }

    setWithWorker(prop, value) {
        return this.set(prop, value);
    }

    remove() {
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

        createObj(type, attrs) {
            const normalized = normalizeType(type);
            const obj = new Roll20Object(world, normalized, makeId(), attrs || {});
            objects.push(obj);
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

        playerIsGM() {
            return true;
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
                callback();
            }
        },

        setDefaultTokenForCharacter(character, token) {
            character.set('defaulttoken', JSON.stringify(token.toJSON()));
        },

        remove(obj) {
            const index = objects.indexOf(obj);
            if (index >= 0) {
                objects.splice(index, 1);
            }
        },

        globals() {
            return {
                state: {},
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

    return world;
}

module.exports = {
    createRoll20Mock
};
