"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserProperties = exports.BaseObjectProperties = exports.Entity = exports.User = exports.BaseRepository = exports.BaseObjectCore = exports.AbstractObject = exports.ObjectUri = exports.DataObject = void 0;
const DataObject_1 = require("./DataObject");
Object.defineProperty(exports, "DataObject", { enumerable: true, get: function () { return DataObject_1.DataObject; } });
const ObjectUri_1 = require("./ObjectUri");
Object.defineProperty(exports, "ObjectUri", { enumerable: true, get: function () { return ObjectUri_1.ObjectUri; } });
const AbstractObject_1 = require("./AbstractObject");
Object.defineProperty(exports, "AbstractObject", { enumerable: true, get: function () { return AbstractObject_1.AbstractObject; } });
const BaseObjectCore_1 = require("./BaseObjectCore");
Object.defineProperty(exports, "BaseObjectCore", { enumerable: true, get: function () { return BaseObjectCore_1.BaseObjectCore; } });
const BaseObject_1 = require("./BaseObject");
Object.defineProperty(exports, "BaseObjectProperties", { enumerable: true, get: function () { return BaseObject_1.BaseObjectProperties; } });
const BaseRepository_1 = __importDefault(require("./BaseRepository"));
exports.BaseRepository = BaseRepository_1.default;
const User_1 = require("./User");
Object.defineProperty(exports, "User", { enumerable: true, get: function () { return User_1.User; } });
Object.defineProperty(exports, "UserProperties", { enumerable: true, get: function () { return User_1.UserProperties; } });
const Entity_1 = require("./Entity");
Object.defineProperty(exports, "Entity", { enumerable: true, get: function () { return Entity_1.Entity; } });