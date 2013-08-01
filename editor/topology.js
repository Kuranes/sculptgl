'use strict';

function Topology()
{
	this.states_ = null; //for undo-redo
	this.mesh_ = null; //mesh
	this.center_ = [0, 0, 0]; //center point
	this.verticesMap_ = {}; //to detect new vertices at the middle of edge (for subdivision)
	this.radiusSquared_ = 0; //radius squared
	this.iTrisToDelete_ = []; //triangles to be deleted
	this.iVertsToDelete_ = []; //vertices to be deleted
	this.iVertsDecimated_ = []; //vertices to be updated (mainly for the VBO's, used in decimation and adaptive topo)
}


Topology.prototype.init = function(states)
{
	this.states_ = states; //for undo-redo
	this.mesh_ = null; //mesh
	this.center_[0] = 0.0;this.center_[1] = 0.0;this.center_[2] = 1.0;
	// TODO: gc
    this.verticesMap_ = {}; //to detect new vertices at the middle of edge (for subdivision)
	this.radiusSquared_ = 0; //radius squared
	this.iTrisToDelete_.length = 0; //triangles to be deleted
	this.iVertsToDelete_.length = 0; //vertices to be deleted
	this.iVertsDecimated_.length = 0; //vertices to be updated (mainly for the VBO's, used in decimation and adaptive topo)
}