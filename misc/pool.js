'use strict';

 /*
 * Keep reference of object that can be reused across frame
 * Targeting ZERO new/delete and Javascript Garbage collector stuttering 
 *  TODO: Add stats & reports for developper per application  finer calibration (max, min, average)
 *  TODO: Debug Mode: check if not putting object twice, etc.
 *  USAGE: trianglesPool = new ObjectMemoryPool(Triangle).grow(50);
 */
var ObjectMemoryPool = function(pooledObjectClassName) {
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

var DataMemoryPool = function (__sizeStart, __type){

    return {
        _type : __type,
        _free: __sizeStart,
        _pool : new __type(__sizeStart),
        _chunks : [{data: [], pos: __sizeStart}],// {data: arrayofdata, pos; 123}

            // find in allocated pointers.
        free : function (data) {
            if (data === undefined || data === null || data === 0)
              return;
            var chunck = null;
            for (var i = 0; i < this._chunks.length; i++){
                chunck = this._chunks[i];
                if(chunck.data === data){
                    this._chunks.splice(i, 1);
                    this._free += data.length;
                    console.log("Memory Pool free (" + this._type.toString() + "): " + this._free + " / " + this._pool.length + " freed:" + data.length);
                    return;
                }
            }
            console.log("cannot free: " + data );
            if (console.trace) console.trace();
        },

        // resize if too fragmented.
        // resize if no more place
        resize : function (newSize){
            // Todo: handle fragementation by defragmenting/compacting
            if (newSize > this._pool.length){
                var newPool = new this._type(newSize);
                this._free = this._free + (newSize - this._pool.length);
                newPool.set(this._pool);
                delete this._pool;
                this._pool = newPool;

                this._chunks[this._chunks.length -1].pos = this._pool.length;
            }
        },

        // find spot & update _freesize/biggestChunk
        malloc : function (n) {
            var chunck = null;
            var allocatedSize = 0;
            var chunkStart = 0;
            var biggestChunk = 0;
            for (var i = 0; i < this._chunks.length; i++){
                chunck = this._chunks[i];
                if(chunck.pos - chunkStart > n){
                    var newChunck = { data : this._pool.subarray(chunkStart, chunkStart + n), pos: chunkStart};
                    this._chunks.splice(i, 0, newChunck);
                    //Error().stack(newChunck);
                    newChunck.stack = Error().stack;
                    this._free -= n;
                    console.assert(newChunck.data.length === n);
                    console.log("Memory Pool malloc (" + this._type.toString() + "): " + this._free + " / " + this._pool.length + " requested:" + newChunck.data.length);
                    return newChunck.data;
                }
                allocatedSize += chunck.data.length;
                biggestChunk = Math.max(biggestChunk, chunck.pos - chunkStart);
                chunkStart = chunck.pos + chunck.data.length;
            }
            console.assert(allocatedSize + this._free === this._pool.length);

            if (this._free > n)
              console.log("Memory Pool too fragmented (" + this._type.toString() + "): biggestChunk " + biggestChunk +" requested:" + n);
            else
              console.log("Memory Pool too small (" + this._type.toString() + "): " + this._free + " / " + this._pool.length + " requested:" + n);
            // didn't find any spot.
            this.resize((this._pool.length + n) * 2);
            return this.malloc(n);
        }

    };
}