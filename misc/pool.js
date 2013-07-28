
 /*
 * Keep reference of object that can be reused across frame
 * Targeting ZERO new/delete and Javascript Garbage collector stuttering 
 *  TODO: Add stats & reports for developper per application  finer calibration (max, min, average)
 *  TODO: Debug Mode: check if not putting object twice, etc.
 *  USAGE: trianglesPool = new ObjectMemoryPool(Triangle).grow(50);
 */
ObjectMemoryPool = function(pooledObjectClassName) {
    return {
        _memPool: [],
        reset: function() {
            this._memPool = [];
            return this;
        },
        put: function(obj) {
            this._memPool.push(obj);
        },
        get: function() {
            if(this._memPool.length > 0) return this._memPool.pop();
            this.grow();
            return this.get();
        },
        grow: function(sizeAdd) {
            if(sizeAdd === undefined) sizeAdd = (this._memPool.length > 0) ? this._memPool.length * 2: 20;
            var i = this._memPool.length;
            while(i++ < sizeAdd) this._memPool.push(new pooledObjectClassName());
            return this;
        }
    };
};
