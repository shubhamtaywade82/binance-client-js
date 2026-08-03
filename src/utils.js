/**
 * Utility function to apply mixins to a class
 * Copies methods from base classes to derived class prototype
 * 
 * @param {Function} derivedCtor - The target class constructor
 * @param {Array<Function>} baseCtors - Array of base class constructors to mixin
 */
function applyMixins(derivedCtor, baseCtors) {
    baseCtors.forEach((baseCtor) => {
        Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
            if (name !== 'constructor') {
                Object.defineProperty(
                    derivedCtor.prototype,
                    name,
                    Object.getOwnPropertyDescriptor(baseCtor.prototype, name) || 
                    Object.create(null)
                );
            }
        });
    });
}

module.exports = { applyMixins };
