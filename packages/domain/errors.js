"use strict";

class DomainError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

module.exports = {
  DomainError,
};
