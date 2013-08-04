'use strict';


(function() {
    var lastTime = 0;
    var vendors = ['moz', 'webkit'];// firefox && safari
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
    }
    if (!window.requestAnimationFrame)
      alert("browser is too old. Probably no webgl there anyway");
}());function SculptGL()
{
  this.gl_ = null; //webgl context

  //controllers stuffs
  this.lastPointerX_ = 0; //the last position of the mouse in x
  this.lastPointerY_ = 0; //the last position of the mouse in y
  this.sumDisplacement_ = 0; //sum of the displacement mouse
  this.cameraTimer_ = -1; //interval id (used for zqsd/wasd/arrow moves)
  this.usePenRadius_ = true; //the pen pressure acts on the tool's radius
  this.usePenIntensity_ = false; //the pen pressure acts on the tool's intensity

  //symmetry stuffs
  this.symmetry_ = false; //if symmetric sculpting is enabled
  this.continuous_ = false; //continuous sculpting
  this.sculptTimer_ = -1; //continuous interval timer
  this.pressureRadius_ = 0; //for continuous sculpting
  this.pressureIntensity_ = 0; //for continuous sculpting
  this.pointerX_ = 0; //for continuous sculpting
  this.pointerY_ = 0; //for continuous sculpting
  this.ptPlane_ = [0, 0, 0]; //point origin of the plane symmetry
  this.nPlane_ = [1, 0, 0]; //normal of plane symmetry

  //core of the app
  this.states_ = new States(); //for undo-redo
  this.camera_ = new Camera(); //the camera
  this.picking_ = new Picking(this.camera_); //the ray picking
  this.pickingSym_ = new Picking(this.camera_); //the symmetrical picking
  this.sculpt_ = new Sculpt(this.states_); //sculpting management
  this.mesh_ = null; //the mesh

  //datas
  this.textures_ = []; //textures
  this.shaders_ = {}; //shaders
  this.sphere_ = ''; //sphere

  //ui stuffs
  this.ctrlColor_ = null; //color controller
  this.ctrlShaders_ = null; //shaders controller
  this.ctrlSculpt_ = null; //sculpt controller
  this.ctrlNegative_ = null; //negative sculpting controller
  this.ctrlNbVertices_ = null; //display number of vertices controller
  this.ctrlNbTriangles_ = null; //display number of triangles controller

  //functions
  this.resetSphere_ = this.resetSphere; //load sphere
  this.open_ = this.openFile; //open file button (trigger hidden html input...)
  this.save_ = this.saveFile; //save file function
  this.exportSketchfab_ = this.exportSketchfab; //upload file on sketchfab
  this.undo_ = this.onUndo; //undo last action
  this.redo_ = this.onRedo; //redo last action
  this.dummyFunc_ = function () {}; //empty function... stupid trick to get a simple button in dat.gui
  this.lastVerticsCount = 0;
  this.pointerState = new Array(10);
  for (var i = 0; i < 10; i++)
    this.pointerState[i] = {active: false, x: -1, y: -1, lastx: -1, lasty: -1};
}

SculptGL.elementIndexType = 0; //element index type (ushort or uint)
SculptGL.indexArrayType = Uint16Array; //typed array for index element (uint16Array or uint32Array)

SculptGL.prototype = {
  /** Initialization */
  start: function ()
  {
    var self = this;
    $('#fileopen').change(function (event)
    {
      self.loadFile(event);
    });
    this.initWebGL();
    this.loadShaders();
    this.initGui();
    this.onWindowResize();
    this.loadTextures();
    this.initEvents();

  },

  /** Initialize */
  initEvents: function ()
  {
    var self = this;
    var $canvas = $('#canvas');

    $canvas[0].addEventListener("mousedown", this.onMouseDown.bind(this), false);
    $canvas[0].addEventListener("mouseup", this.onMouseUp.bind(this), false);

    $canvas[0].addEventListener("pointerdown", this.onPointerDown.bind(this), false);
    $canvas[0].addEventListener("pointermove", this.onPointerMove.bind(this), false);
    $canvas[0].addEventListener("pointerup", this.onPointerUp.bind(this), false);
    $canvas[0].addEventListener("pointerout", this.onPointerOut.bind(this), false);


    // mouseouseUp(event);
    $canvas.mousewheel(function (event, delta)
    {
      self.onMouseWheel(event, delta);
    });


    $canvas[0].addEventListener('webglcontextlost', self.onContextLost, false);
    $canvas[0].addEventListener('webglcontextrestored', self.onContextRestored, false);
    $(window).keydown(function (event)
    {
      self.onKeyDown(event);
    });
    $(window).keyup(function (event)
    {
      self.onKeyUp(event);
    });
    $(window).resize(function (event)
    {
      self.onWindowResize(event);
    });
    // prevent touch scroll
    $(window.body).bind('touchmove', function (event) {
      event.preventDefault();
    });

  },

  /** Load webgl context */
  initWebGL: function ()
  {
    var attributes = {
      antialias: false,
      stencil: true,
      preserveDrawingBuffer: true,
    };
    try
    {
      this.gl_ = $('#canvas')[0].getContext('webgl', attributes) || $('#canvas')[0].getContext('experimental-webgl', attributes);
    }
    catch (e)
    {
      alert('Could not initialise WebGL.');
    }
    var gl = this.gl_;
    if (gl)
    {
      if (gl.getExtension('OES_element_index_uint'))
      {
        SculptGL.elementIndexType = gl.UNSIGNED_INT;
        SculptGL.indexArrayType = Uint32Array;
      }
      else
      {
        SculptGL.elementIndexType = gl.UNSIGNED_SHORT;
        SculptGL.indexArrayType = Uint16Array;
      }
      gl.viewportWidth = $(window).width();
      gl.viewportHeight = $(window).height();
      gl.clearColor(0.2, 0.2, 0.2, 1);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }
  },

  /** Load textures (preload) */
  loadTextures: function ()
  {
    var mat1 = new Image();
    var self = this;
    mat1.onload = function ()
    {
      self.loadSphere();
    };
    mat1.src = 'ressources/clay.jpg';
    var mat2 = new Image();
    mat2.src = 'ressources/chavant.jpg';
    var mat3 = new Image();
    mat3.src = 'ressources/skin.jpg';
    var mat4 = new Image();
    mat4.src = 'ressources/drink.jpg';
    var mat5 = new Image();
    mat5.src = 'ressources/redvelvet.jpg';
    var mat6 = new Image();
    mat6.src = 'ressources/orange.jpg';
    var mat7 = new Image();
    mat7.src = 'ressources/bronze.jpg';
    this.textures_.push(mat1, mat2, mat3, mat4, mat5, mat6, mat7);
  },

  /** Load shaders as a string */
  loadShaders: function ()
  {
    var xhrShader = function (path)
    {
      var shaderXhr = new XMLHttpRequest();
      shaderXhr.open('GET', path, false);
      shaderXhr.send(null);
      return shaderXhr.responseText;
    };
    var shaders = this.shaders_;
    shaders.phongVertex = xhrShader('shaders/phongVertex.glsl');
    shaders.phongFragment = xhrShader('shaders/phongFragment.glsl');
    shaders.wireframeVertex = xhrShader('shaders/wireframeVertex.glsl');
    shaders.wireframeFragment = xhrShader('shaders/wireframeFragment.glsl');
    shaders.transparencyVertex = xhrShader('shaders/transparencyVertex.glsl');
    shaders.transparencyFragment = xhrShader('shaders/transparencyFragment.glsl');
    shaders.reflectionVertex = xhrShader('shaders/reflectionVertex.glsl');
    shaders.reflectionFragment = xhrShader('shaders/reflectionFragment.glsl');
  },

  /** Load the sphere */
  loadSphere: function ()
  {
    var sphereXhr = new XMLHttpRequest();
    sphereXhr.open('GET', 'ressources/sphere.obj', true);
    var self = this;
    sphereXhr.onload = function ()
    {
      self.sphere_ = this.responseText;
      self.resetSphere();
    };
    sphereXhr.send(null);
  },

  /** Initialize dat-gui stuffs */
  initGui: function ()
  {

    var guiContainer = document.getElementById('gui-container');
    var guiEditing = new dat.GUI({ autoPlace: false });

    this.initEditingGui(guiEditing);
    guiContainer.appendChild(guiEditing.domElement);

    this.initMenu();
  },

  /** Initialize the top menu */
  initMenu: function()
  {
    var self = this;

    // File
    $('#load-obj').on('click', this.open_.bind(this));
    $('#save-obj').on('click', this.save_.bind(this));

    // History
    $('#undo').on('click', this.undo_.bind(this));
    $('#redo').on('click', this.redo_.bind(this));

    // Options
    $('.togglable').on('click', function() {
      var group = $(this).data('radio');
      if (group) {
        $(this).siblings('li[data-radio='+group+']').removeClass('checked');
        $(this).addClass('checked');

        if (group === 'camera-mode') {
          self.camera_.updateMode(parseInt($(this).data('value'), 10));
          self.render();
        }
      } else {
        $(this).toggleClass('checked');

        if ($(this).data('value') === 'radius') {
          this.usePenRadius_ != this.usePenRadius_;
        } else if ($(this).data('value') === 'intensity') {
          this.usePenIntensity_ != this.usePenIntensity_;
        }
      }
    });

    // About
    $('#about').on('click', function() {
      $('#about-popup').addClass('visible');
    });

    $('#about-popup .cancel').on('click', function() {
      $('#about-popup').removeClass('visible');
    });

    // Buttons
    $('#reset').on('click', this.resetSphere_.bind(this));
    $('#export').on('click', this.exportSketchfab_.bind(this));
  },

  /** Initialize the mesh editing gui (on the right) */
  initEditingGui: function (gui)
  {
    var self = this;

    //sculpt fold
    var foldSculpt = gui.addFolder('Sculpt');
    var optionsSculpt = {
      'Brush (1)': Sculpt.tool.BRUSH,
      'Inflate (2)': Sculpt.tool.INFLATE,
      'Rotate (3)': Sculpt.tool.ROTATE,
      'Smooth (4)': Sculpt.tool.SMOOTH,
      'Flatten (5)': Sculpt.tool.FLATTEN,
      'Pinch (6)': Sculpt.tool.PINCH,
      'Crease (7)': Sculpt.tool.CREASE,
      'Drag (8)': Sculpt.tool.DRAG
    };
    this.ctrlSculpt_ = foldSculpt.add(this.sculpt_, 'tool_', optionsSculpt).name('Tool');
    this.ctrlSculpt_.onChange(function (value)
    {
      self.sculpt_.tool_ = parseInt(value, 10);
    });
    this.ctrlNegative_ = foldSculpt.add(this.sculpt_, 'negative_').name('Negative (N)');
    foldSculpt.add(this, 'continuous_').name('Continuous');
    foldSculpt.add(this, 'symmetry_').name('Symmetry');
    foldSculpt.add(this.sculpt_, 'culling_').name('Sculpt culling');
    foldSculpt.add(this.picking_, 'rDisplay_', 20, 200).name('Radius');
    foldSculpt.add(this.sculpt_, 'intensity_', 0, 1).name('Intensity');
    foldSculpt.open();

    //topo fold
    var foldTopo = gui.addFolder('Topology');
    var optionsTopo = {
      'Static': Sculpt.topo.STATIC,
      'Subdivision': Sculpt.topo.SUBDIVISION,
      'Decimation': Sculpt.topo.DECIMATION,
      'Uniformisation': Sculpt.topo.UNIFORMISATION,
      'Adaptive (!!!)': Sculpt.topo.ADAPTIVE
    };
    var ctrlTopo = foldTopo.add(this.sculpt_, 'topo_', optionsTopo).name('Tool');
    ctrlTopo.onChange(function (value)
    {
      self.sculpt_.topo_ = parseInt(value, 10);
    });
    foldTopo.add(this.sculpt_, 'detail_', 0, 1).name('Detail');
    foldTopo.open();


    //mesh fold
    var foldMesh = gui.addFolder('Mesh');
    this.ctrlColor_ = foldMesh.addColor(new Render(), 'color_').name('Color');
    this.ctrlColor_.onChange(function ()
    {
      self.render();
    });
    this.ctrlNbVertices_ = foldMesh.add(this, 'dummyFunc_').name('Vertices : 0');
    this.ctrlNbTriangles_ = foldMesh.add(this, 'dummyFunc_').name('Triangles : 0');
    // var optionsShaders = {
    //   'Phong': Render.mode.PHONG,
    //   'Wireframe (slow)': Render.mode.WIREFRAME,
    //   'Transparency': Render.mode.TRANSPARENCY,
    //   'Clay': Render.mode.MATERIAL,
    //   'Chavant': Render.mode.MATERIAL + 1,
    //   'Skin': Render.mode.MATERIAL + 2,
    //   'Drink': Render.mode.MATERIAL + 3,
    //   'Red velvet': Render.mode.MATERIAL + 4,
    //   'Orange': Render.mode.MATERIAL + 5,
    //   'Bronze': Render.mode.MATERIAL + 6
    // };
    // this.ctrlShaders_ = foldMesh.add(new Render(), 'shaderType_', optionsShaders).name('Shader');
    // this.ctrlShaders_.onChange(function (value)
    // {
    //   if (self.mesh_)
    //   {
    //     self.mesh_.render_.updateShaders(parseInt(value, 10), self.textures_, self.shaders_);
    //     self.mesh_.updateBuffers();
    //     self.render();
    //   }
    // });
    foldMesh.open();
  },
  /** render mesh */
 doRender: function()
 {
    var gl = this.gl_;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this.camera_.updateView();
    if (this.mesh_){
      this.mesh_.doUpdateBuffers();
      this.mesh_.render(this.camera_, this.picking_);
      if (this.lastVerticsCount){
        if (this.mesh_.vertices_.length - this.lastVerticsCount > 1000 ){
          this.lastVerticsCount = this.mesh_.vertices_.length;
          this.ctrlNbVertices_.name('Vertices : ' + this.mesh_.vertices_.length);
          this.ctrlNbTriangles_.name('Triangles : ' + this.mesh_.triangles_.length);
        }
      }
      else{
        this.lastVerticsCount = this.mesh_.vertices_.length;
      }
    }

    this.queued = false;

 },
  /** request Render mesh */
  render: function ()
  {
    if (!window.requestAnimationFrame){
      this.doRender();
      return;
    }
    if (this.queued)
      return;
    this.queued = true;

    window.requestAnimationFrame(this.doRender.bind(this), $('#canvas')[0]);
  },

  /** Called when the window is resized */
  onWindowResize: function ()
  {
    var newWidth = $(window).width(),
      newHeight = $(window).height();
    this.camera_.width_ = newWidth;
    this.camera_.height_ = newHeight;
    $('#canvas').attr('width', newWidth);
    $('#canvas').attr('height', newHeight);
    var gl = this.gl_;
    gl.viewportWidth = newWidth;
    gl.viewportHeight = newHeight;
    gl.viewport(0, 0, newWidth, newHeight);
    this.camera_.updateProjection();
    this.render();
  },

  /** Key pressed event */
  onKeyDown: function (event)
  {
    event.stopPropagation();
    event.preventDefault();
    var key = event.which;
    if (event.ctrlKey && key === 90) //z key
    {
      this.onUndo();
      return;
    }
    else if (event.ctrlKey && key === 89) //y key
    {
      this.onRedo();
      return;
    }
    switch (key)
    {
    case 49: // 1
    case 97: // NUMPAD 1
      this.ctrlSculpt_.setValue(Sculpt.tool.BRUSH);
      break;
    case 50: // 2
    case 98: // NUMPAD 2
      this.ctrlSculpt_.setValue(Sculpt.tool.INFLATE);
      break;
    case 51: // 3
    case 99: // NUMPAD 3
      this.ctrlSculpt_.setValue(Sculpt.tool.ROTATE);
      break;
    case 52: // 4
    case 100: // NUMPAD 4
      this.ctrlSculpt_.setValue(Sculpt.tool.SMOOTH);
      break;
    case 53: // 5
    case 101: // NUMPAD 5
      this.ctrlSculpt_.setValue(Sculpt.tool.FLATTEN);
      break;
    case 54: // 6
    case 102: // NUMPAD 6
      this.ctrlSculpt_.setValue(Sculpt.tool.PINCH);
      break;
    case 55: // 7
    case 103: // NUMPAD 7
      this.ctrlSculpt_.setValue(Sculpt.tool.CREASE);
      break;
    case 56: // 8
    case 104: // NUMPAD 8
      this.ctrlSculpt_.setValue(Sculpt.tool.DRAG);
      break;
    case 78: // N
      this.ctrlNegative_.setValue(!this.sculpt_.negative_);
      break;
    case 37: // LEFT
    case 81: // Q
    case 65: // A
      this.camera_.moveX_ = -1;
      break;
    case 39: // RIGHT
    case 68: // D
      this.camera_.moveX_ = 1;
      break;
    case 38: // UP
    case 90: // Z
    case 87: // W
      this.camera_.moveZ_ = -1;
      break;
    case 40: // DOWN
    case 83: // S
      this.camera_.moveZ_ = 1;
      break;
    }
    var self = this;
    if (this.cameraTimer_ === -1)
      this.cameraTimer_ = setInterval(function ()
      {
        self.camera_.updateTranslation();
        self.render();
      }, 20);
  },

  /** Key released event */
  onKeyUp: function (event)
  {
    event.stopPropagation();
    event.preventDefault();
    var key = event.which;
    switch (key)
    {
    case 37: // LEFT
    case 81: // Q
    case 65: // A
    case 39: // RIGHT
    case 68: // D
      this.camera_.moveX_ = 0;
      break;
    case 38: // UP
    case 90: // Z
    case 87: // W
    case 40: // DOWN
    case 83: // S
      this.camera_.moveZ_ = 0;
      break;
    }
    if (this.cameraTimer_ !== -1 && this.camera_.moveX_ === 0 && this.camera_.moveZ_ === 0)
    {
      clearInterval(this.cameraTimer_);
      this.cameraTimer_ = -1;
    }
  },
  onMouseDown: function(evt) {
    var  stateChg = true;
    switch(evt.which){
      case 1:this.pointerState[1].active = stateChg;break;
      case 2:this.pointerState[3].active = stateChg;break;
      case 3:this.pointerState[2].active = stateChg;break;
    }

  },
  onMouseUp: function(evt) {
    var  stateChg = false;
    switch(evt.which){
      case 1:this.pointerState[1].active = stateChg;break;
      case 2:this.pointerState[3].active = stateChg;break;
      case 3:this.pointerState[2].active = stateChg;break;
    }
  },

  onPointerDown: function(evt) {
    evt.stopPropagation();
    evt.preventDefault();

    var pointers = evt.getPointerList();
    for (var i = 0; i < pointers.length; i++){
      var ptr = pointers[i];
      var state = this.pointerState[ptr.identifier ];
      if (ptr.pointerType !== "mouse")
        state.active = true;
      state.lastx = state.x;
      state.lasty = state.y;
      state.x = ptr.pageX;
      state.y = ptr.pageY;
    }

    var pointerX =   this.pointerState[1].x,
      pointerY = this.pointerState[1].y;

    var pressure = Tablet.pressure();
    var pressureRadius = this.usePenRadius_ ? pressure : 1;
    var pressureIntensity = this.usePenIntensity_ ? pressure : 1;

    if (this.pointerState[2].active) {
      // 2 finger swipe or button 2/3 action move user
      this.camera_.start(pointerX, pointerY);
    }
    else if (this.pointerState[1].active)
    {
      if (this.mesh_)
      {
        this.sumDisplacement_ = 0;
        this.states_.start();
        if (this.sculpt_.tool_ === Sculpt.tool.ROTATE)
          this.sculpt_.startRotate(this.picking_, pointerX, pointerY, this.pickingSym_, this.ptPlane_, this.nPlane_, this.symmetry_);
        else if (this.continuous_ && this.sculpt_.tool_ !== Sculpt.tool.DRAG)
        {
          this.pressureRadius_ = pressureRadius;
          this.pressureIntensity_ = pressureIntensity;
          this.pointerX_ = pointerX;
          this.pointerY_ = pointerY;
          var self = this;
          this.sculptTimer_ = setInterval(function ()
          {
            self.sculptStroke(self.pointerX_, self.pointerY_, self.pressureRadius_, self.pressureIntensity_);
            self.render();
          }, 20);
        }
        else
          this.sculptStroke(pointerX, pointerY, pressureRadius, pressureIntensity);
      }
    }
  },
  onPointerUp: function(evt){
    evt.stopPropagation();
    evt.preventDefault();

    var pointers = evt.getPointerList();
    for (var i = 0; i < pointers.length; i++){
      var ptr = pointers[i];
      var state = this.pointerState[ptr.identifier ];
      if (ptr.pointerType !== "mouse")
        state.active = false;
        state.lastx = state.x;
        state.lasty = state.y;
        state.x = ptr.pageX;
        state.y = ptr.pageY;
    }

   // if (!this.pointerState[1].active){
      if (this.mesh_)
        this.mesh_.checkLeavesUpdate();
      if (this.sculptTimer_ !== -1)
      {
        clearInterval(this.sculptTimer_);
        this.sculptTimer_ = -1;
      }
    //}
  },

  onPointerMove: function(evt){
    evt.stopPropagation();
    evt.preventDefault();

    var pointers = evt.getPointerList();
    for (var i = 0; i < pointers.length; i++){
      var ptr = pointers[i];
      var state = this.pointerState[ptr.identifier];
      state.lastx = state.x;
      state.lasty = state.y;
      state.x = ptr.pageX;
      state.y = ptr.pageY;
    }

    var pointerX =   this.pointerState[1].x,
      pointerY = this.pointerState[1].y,
      lastPointerX = this.pointerState[1].lastx,
      lastPointerY = this.pointerState[1].lasty;

    var pressure = Tablet.pressure();
    var pressureRadius = this.usePenRadius_ ? pressure : 1;
    var pressureIntensity = this.usePenIntensity_ ? pressure : 1;

    var tool = this.sculpt_.tool_;
    if (this.mesh_ && (!this.pointerState[1].active || (tool !== Sculpt.tool.ROTATE && tool !== Sculpt.tool.DRAG)))
       this.picking_.intersectionMouseMesh(this.mesh_, mouseX, mouseY, pressureRadius);


    if (this.continuous_ && this.sculptTimer_ !== -1)
    {
      this.pressureRadius_ = pressureRadius;
      this.pressureIntensity_ = pressureIntensity;
      this.pointerX_ = pointerX;
      this.pointerY_ = pointerY;
      return;
    }

    if (this.pointerState[3].active){
      this.camera_.translate((pointerX - lastPointerX) / 3000, (pointerY - lastPointerY) / 3000);
    }
    else if (this.pointerState[2].active){
      // rotate
      this.camera_.rotate(pointerX, pointerY);
    }
    else if (this.pointerState[1].active){
      // user action

      if (tool !== Sculpt.tool.ROTATE){
        this.sculptStroke(pointerX, pointerY, pressureRadius, pressureIntensity);
        this.mesh_.updateBuffers();
      }
      else if (this.picking_.mesh_)
      {
        this.picking_.pickVerticesInSphere(this.picking_.rWorldSqr_);
        this.sculpt_.sculptMesh(this.picking_, pressureIntensity, false, pointerX, pointerY, lastPointerX, lastPointerY);

        if (this.symmetry_)
        {
          this.pickingSym_.pickVerticesInSphere(this.pickingSym_.rWorldSqr_);
          this.sculpt_.sculptMesh(this.pickingSym_, pressureIntensity, true, lastPointerX, lastPointerY, pointerX, pointerY);
        }
        this.mesh_.updateBuffers();
      }
    }
      //this.render();
    this.lastPointerX_ = pointerX;
    this.lastPointerY_ = pointerY;
    this.render();
  },

  onPointerOut: function(evt){
    evt.stopPropagation();
    evt.preventDefault();

    for (var i = 0; i < this.pointerState.length; i++){
        var state = this.pointerState[i];
        state.active = false;
    }

    if (this.mesh_)
      this.mesh_.checkLeavesUpdate();
    if (this.sculptTimer_ !== -1)
    {
      clearInterval(this.sculptTimer_);
      this.sculptTimer_ = -1;
    }
  },
  /// Mouse wheel event
  onMouseWheel: function (event, delta)
  {
    event.stopPropagation();
    event.preventDefault();
    this.camera_.zoom(delta / 100);
    this.render();
  },


  /** Make a brush stroke */
  sculptStroke: function (pointerX, pointerY, pressureRadius, pressureIntensity)
  {
    var ptPlane = this.ptPlane_,
      nPlane = this.nPlane_;
    var picking = this.picking_,
      pickingSym = this.pickingSym_;
    var dx = pointerX - this.lastPointerX_,
      dy = pointerY - this.lastPointerY_;
    var dist = Math.sqrt(dx * dx + dy * dy);
    this.sumDisplacement_ += dist;
    var minSpacing = 0.2 * picking.rDisplay_;
    var step = dist / Math.floor(dist / minSpacing);
    dx /= dist;
    dy /= dist;

    if (!this.continuous_)
    {
     pointerX = this.lastPointerX_;
    pointerY = this.lastPointerY_;

    }
    else
    {
      this.sumDisplacement_ = 0;
      dist = 0;
    }
    var mesh = this.mesh_;
    var sym = this.symmetry_;
    var sculpt = this.sculpt_;
    var drag = sculpt.tool_ === Sculpt.tool.DRAG;
    if (drag)
    {
      minSpacing = 0.0;
      picking.mesh_ = pickingSym.mesh_ = mesh;
      var inter = picking.interPoint_;
      var interSym = pickingSym.interPoint_;
      interSym[0] = inter[0];
      interSym[1] = inter[1];
      interSym[2] = inter[2];
      Geometry.mirrorPoint(interSym, ptPlane, nPlane);
    }
    if (this.sumDisplacement_ > minSpacing * 50.0)
      this.sumDisplacement_ = 0;
    else if (this.sumDisplacement_ > minSpacing || this.sumDisplacement_ === 0)
    {
      this.sumDisplacement_ = 0;
      for (var i = 0; i <= dist; i += step)
      {
        if (drag)
          sculpt.updateDragDir(mesh, picking, pointerX, pointerY, pressureRadius);
        else
          picking.intersectionMouseMesh(mesh, pointerX, pointerY, pressureRadius);


        if (!picking.mesh_)
          break;
        picking.pickVerticesInSphere(picking.rWorldSqr_);
        sculpt.sculptMesh(picking, pressureIntensity);
        if (sym)
        {
          if (drag)
            sculpt.updateDragDir(mesh, pickingSym, pointerX, pointerY, pressureRadius, ptPlane, nPlane);
          else
            pickingSym.intersectionMouseMesh(mesh, pointerX, pointerY, pressureRadius, ptPlane, nPlane);

          if (!pickingSym.mesh_)
            break;
          pickingSym.rWorldSqr_ = picking.rWorldSqr_;
          pickingSym.pickVerticesInSphere(pickingSym.rWorldSqr_);
          sculpt.sculptMesh(pickingSym, pressureIntensity, true);
        }
        pointerX += dx * step;
        pointerY += dy * step;
      }
      this.mesh_.updateBuffers();
    }
  },

  /** WebGL context is lost */
  onContextLost: function ()
  {
    alert('shit happens : context lost');
  },

  /** WebGL context is restored */
  onContextRestored: function ()
  {
    alert('context is restored');
  },

  /** Load file */
  loadFile: function (event)
  {
    event.stopPropagation();
    event.preventDefault();
    if (event.target.files.length === 0)
      return;
    var file = event.target.files[0];
    var name = file.name;
    if (!name.endsWith('.obj') || !name.endsWith('.stl') )
      return;
    var reader = new FileReader();
    var self = this;
    reader.onload = function (evt)
    {
      self.startMeshLoad();

    if (name.endsWith('.obj'))
      Files.importOBJ(evt.target.result, self.mesh_);
    else if (name.endsWith('.stl'))
      Files.importSTL(evt.target.result, self.mesh_);

      self.endMeshLoad();
      $('#fileopen').replaceWith($('#fileopen').clone(true));
    };
    reader.readAsText(file);
  },

  /** Open file */
  resetSphere: function ()
  {
    this.startMeshLoad();
    Files.importOBJ(this.sphere_, this.mesh_);
    this.endMeshLoad();
  },

  /** Initialization before loading the mesh */
  startMeshLoad: function ()
  {
    this.mesh_ = new Mesh(this.gl_);
    this.states_.reset();
    this.states_.mesh_ = this.mesh_;
    this.sculpt_.mesh_ = this.mesh_;
    //reset flags (not necessary...)
    Mesh.stateMask_ = 1;
    Vertex.tagMask_ = 1;
    Vertex.sculptMask_ = 1;
    Triangle.tagMask_ = 1;
  },

  /** The loading is finished, set stuffs ... and update camera */
  endMeshLoad: function ()
  {
    var mesh = this.mesh_;
    mesh.render_.shaderType_ = Render.mode.MATERIAL;
    mesh.initMesh(this.textures_, this.shaders_);
    mesh.moveTo([0, 0, 0]);
    var length = vec3.dist(mesh.octree_.aabbLoose_.max_, mesh.octree_.aabbLoose_.min_);
    this.camera_.reset();
    this.camera_.globalScale_ = length;
    this.camera_.zoom(-0.4);
    this.updateGuiMesh();
    this.render();
  },

  /** Update information on mesh */
  updateGuiMesh: function ()
  {
    if (!this.mesh_)
      return;
    var mesh = this.mesh_;
    this.ctrlColor_.object = mesh.render_;
    this.ctrlColor_.updateDisplay();
    // this.ctrlShaders_.object = mesh.render_;
    // this.ctrlShaders_.updateDisplay();
   },

  /** Open file */
  openFile: function ()
  {
    $('#fileopen').trigger('click');
  },

  /** Save file */
  saveFile: function ()
  {
    if (!this.mesh_)
      return;
    var data = [Files.exportOBJ(this.mesh_)];
    //var data = [Files.exportSTL(this.mesh_)];
    var blob = new Blob(data,
    {
      type: 'text/plain;charset=utf-8'
    });
    //saveAs(blob, 'yourMesh.stl');
    saveAs(blob, 'yourMesh.obj');
  },

  /** Export to Sketchfab */
  exportSketchfab: function()
  {
    if(!this.mesh_)
      return;
    Files.exportSketchfab(this.mesh_, this.ctrlColor_.__color.__state);

    // Prevent shortcut keys from triggering in Sketchfab export
    $('.skfb-uploader').on('keydown', function(e) {
      e.stopPropagation();
    });
  },

  /** When the user undos an action */
  onUndo: function ()
  {
    this.states_.undo();
    this.render();
    this.updateGuiMesh();
  },

  /** When the user redos an action */
  onRedo: function ()
  {
    this.states_.redo();
    this.render();
    this.updateGuiMesh();
  }
};
