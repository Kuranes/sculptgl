'use strict';


function Triangle()
{
  this.id_ = 0; //id
  this.normal_ = [0.0, 0.0, 1.0]; //normal of triangle
  this.aabb_ = AabbPool.get(); //bounding box of the triangle
  this.leaf_ = null;
  this.posInLeaf_ = null;
  this.tagFlag_ = 1; //general purpose flag (<0 means the vertex is to be deleted)
}

Triangle.tagMask_ = 1; //flag mask value (should be always >= tagFlag_)

Triangle.prototype = {
  /** constructor (pool init) */
  init: function(id)
  {
    this.id_ = id; //id
    this.normal_[0] = 0.0;this.normal_[1] = 0.0;this.normal_[2] = 1.0; //normal of triangle
    this.aabb_.init();
    this.tagFlag_ = 1; //general purpose flag (<0 means the vertex is to be deleted)
    return this;
  },
  /** destructor (pool refill) */
  deInit: function()
  {
    this.leaf_ = null;
    this.posInLeaf_ = null;
    TrianglePool.put(this);
  },
  /** Clone triangle */
  clone: function ()
  {
    var t = TrianglesPool.get().init(this.id_);
    t.normal_[0] = this.normal_[0];t.normal_[1] = this.normal_[1];t.normal_[2] = this.normal_[2];
    t.aabb_ = this.aabb_.clone();
    t.leaf_ = this.leaf_;
    t.posInLeaf_ = this.posInLeaf_;
    return t;
  }
};
