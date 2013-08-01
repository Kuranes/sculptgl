'use strict';

function Vertex(id)
{
  this.id_ = id; //id
  this.tIndices_ = []; //neighboring triangles indices
  this.ringVertices_ = []; //neighboring vertices (1-ring)

  this.tagFlag_ = 1; //general purpose flag (<0 means the vertex is to be deleted)
  this.sculptFlag_ = 1; //sculpting flag
  this.stateFlag_ = 1; //flag for history
}

Vertex.tagMask_ = 1; //flag mask value (should be always >= tagFlag_)
Vertex.sculptMask_ = 1; //flag mask value (should be always >= sculptFlag_)

Vertex.prototype = { 
  init: function(id)
  {
    this.id_ = id; //id 
    this.tagFlag_ = 1; //general purpose flag (<0 means the vertex is to be deleted)
    this.sculptFlag_ = 1; //sculpting flag
    this.stateFlag_ = 1; //flag for history
    return this;
  },
  /** destructor (pool refill) */
  deInit: function()
  {
    this.tIndices_.length = 0; //neighboring triangles indices
    this.ringVertices_.length = 0; //neighboring vertices (1-ring)
    VerticesPool.put(this);
  },
  /** Clone vertex */
  clone: function ()
  {
    var v = VerticesPool.get().init(this.id_);
    v.tIndices_ = this.tIndices_.slice();
    v.ringVertices_ = this.ringVertices_.slice();
    v.tagFlag_ = this.tagFlag_;
    v.sculptFlag_ = this.sculptFlag_;
    v.stateFlag_ = this.stateFlag_;
    return v;
  },

  /** Replace triangle */
  replaceTriangle: function (iTriOld, iTriNew)
  {
    var tIndices = this.tIndices_;
    var nbTris = tIndices.length;
    for (var i = 0; i < nbTris; ++i)
    {
      if (iTriOld === tIndices[i])
      {
        tIndices[i] = iTriNew;
        return;
      }
    }
  },

  /** Replace ring vertex */
  replaceRingVertex: function (iVerOld, iVerNew)
  {
    var ringVertices = this.ringVertices_;
    var nbVerts = ringVertices.length;
    for (var i = 0; i < nbVerts; ++i)
    {
      if (iVerOld === ringVertices[i])
      {
        ringVertices[i] = iVerNew;
        return;
      }
    }
  },

  /** Remove triangle */
  removeTriangle: function (iTri)
  {
    var tIndices = this.tIndices_;
    var nbTris = tIndices.length;
    for (var i = 0; i < nbTris; ++i)
    {
      if (iTri === tIndices[i])
      {
        tIndices[i] = tIndices[nbTris - 1];
        tIndices.pop();
        return;
      }
    }
  },

  /** Remove ring vertex */
  removeRingVertex: function (iVer)
  {
    var ringVertices = this.ringVertices_;
    var nbVerts = ringVertices.length;
    for (var i = 0; i < nbVerts; ++i)
    {
      if (iVer === ringVertices[i])
      {
        ringVertices[i] = ringVertices[nbVerts - 1];
        ringVertices.pop();
        return;
      }
    }
  }
};