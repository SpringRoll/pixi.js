/**
 * @author Mat Groves http://matgroves.com/ @Doormat23
 */
 
 /**
 * The interaction manager deals with mouse and touch events. Any DisplayObject can be interactive
 * This manager also supports multitouch.
 *
 * @class InteractionManager
 * @constructor
 * @param stage {Stage} The stage to handle interactions
 */
PIXI.InteractionManager = function(stage)
{
	/**
	 * a refference to the stage
	 *
	 * @property stage
	 * @type Stage
	 */
	this.stage = stage;

	/**
	 * the mouse data
	 *
	 * @property mouse
	 * @type InteractionData
	 */
	this.mouse = new PIXI.InteractionData();

	/**
	 * an object that stores current touches (InteractionData) by id reference
	 *
	 * @property touchs
	 * @type Object
	 */
	this.touchs = {};
	
	// helpers
	this.tempPoint = new PIXI.Point();
	//this.tempMatrix =  mat3.create();

	this.mouseoverEnabled = true;

	//tiny little interactiveData pool!
	this.pool = [];

	this.interactiveItems = [];
	this.interactionDOMElement = null;

	//this will make it so that you dont have to call bind all the time
	this.onMouseMove = this.onMouseMove.bind( this );
	this.onMouseDown = this.onMouseDown.bind(this);
	this.onMouseOut = this.onMouseOut.bind(this);
	this.onMouseOver = this.onMouseOver.bind(this);
	this.onMouseUp = this.onMouseUp.bind(this);

	this.onTouchStart = this.onTouchStart.bind(this);
	this.onTouchEnd = this.onTouchEnd.bind(this);
	this.onTouchMove = this.onTouchMove.bind(this);
	
	/** The cursor to use for the default cursor. This can be a function (called on changes) or a String CSS value. */
	this.defaultCursor = "default";
	/** The cursor to use for the pointer cursor. This can be a function (called on changes) or a String CSS value. */
	this.pointerCursor = "pointer";
	/** The current mode of the cursor (always 'default' or 'pointer') */
	this.currentCursor = "default";
	
	this.stageIn = null;
	this.stageOut = null;
	
	this.last = 0;
}

// constructor
PIXI.InteractionManager.prototype.constructor = PIXI.InteractionManager;

/**
 * Collects an interactive sprite recursively to have their interactions managed
 *
 * @method collectInteractiveSprite
 * @param displayObject {DisplayObject} the displayObject to collect
 * @param iParent {DisplayObject}
 * @private
 */
PIXI.InteractionManager.prototype.collectInteractiveSprite = function(displayObject, iParent)
{
	var children = displayObject.children;
	var length = children.length;
	
	/// make an interaction tree... {item.__interactiveParent}
	for (var i = length-1; i >= 0; i--)
	{
		var child = children[i];
		
		if(!child.visible) continue;
		
		// push all interactive bits
		if(child.interactive)
		{
			iParent.interactiveChildren = true;
			//child.__iParent = iParent;
			this.interactiveItems.push(child);

			if(child.children.length > 0)
			{
				this.collectInteractiveSprite(child, child);
			}
		}
		else
		{
			child.__iParent = null;

			if(child.children.length > 0)
			{
				this.collectInteractiveSprite(child, iParent);
			}
		}
	}
}

/**
 * Sets the target for event delegation
 *
 * @method setTarget
 * @param target {WebGLRenderer|CanvasRenderer} the renderer to bind events to
 * @private
 */
PIXI.InteractionManager.prototype.setTarget = function(target)
{
	this.target = target;

	//check if the dom element has been set. If it has don't do anything
	if( this.interactionDOMElement === null ) {

		this.setTargetDomElement( target.view );
	}

 	document.body.addEventListener('mouseup',  this.onMouseUp, true);
}


/**
 * Sets the dom element which will receive mouse/touch events. This is useful for when you have other DOM
 * elements ontop of the renderers Canvas element. With this you'll be able to delegate another dom element
 * to receive those events
 *
 * @method setTargetDomElement
 * @param domElement {DOMElement} the dom element which will receive mouse and touch events
 * @private
 */
PIXI.InteractionManager.prototype.setTargetDomElement = function(domElement)
{
	//remove previouse listeners
	if( this.interactionDOMElement !== null ) 
	{
		var oldDOM = this.interactionDOMElement;
		oldDOM.style['-ms-content-zooming'] = '';
    	oldDOM.style['-ms-touch-action'] = '';

		oldDOM.removeEventListener('mousemove',  this.onMouseMove, true);
		oldDOM.removeEventListener('mousedown',  this.onMouseDown, true);
	 	oldDOM.removeEventListener('mouseout',   this.onMouseOut, true);

	 	// aint no multi touch just yet!
		oldDOM.removeEventListener('touchstart', this.onTouchStart, true);
		oldDOM.removeEventListener('touchend', this.onTouchEnd, true);
		oldDOM.removeEventListener('touchmove', this.onTouchMove, true);
	}

	if (window.navigator.msPointerEnabled) 
	{
		// time to remove some of that zoom in ja..
		domElement.style['-ms-content-zooming'] = 'none';
    	domElement.style['-ms-touch-action'] = 'none';
    
		// DO some window specific touch!
	}

	this.interactionDOMElement = domElement;

	domElement.addEventListener('mousemove',  this.onMouseMove, true);
	domElement.addEventListener('mousedown',  this.onMouseDown, true);
 	domElement.addEventListener('mouseout',   this.onMouseOut, true);
 	domElement.addEventListener('mouseover',   this.onMouseOver, true);

 	// aint no multi touch just yet!
	domElement.addEventListener('touchstart', this.onTouchStart, true);
	domElement.addEventListener('touchend', this.onTouchEnd, true);
	domElement.addEventListener('touchmove', this.onTouchMove, true);
}

PIXI.InteractionManager.prototype.cleanup = function()
{
	if(!this.target) return;
	var domElement = this.interactionDOMElement;
	domElement.removeEventListener('mousemove',  this.onMouseMove, true);
	domElement.removeEventListener('mousedown',  this.onMouseDown, true);
	domElement.removeEventListener('mouseout',   this.onMouseOut, true);
 	domElement.removeEventListener('mouseover',   this.onMouseOver, true);
	document.body.removeEventListener('mouseup',  this.onMouseUp, true);

	// aint no multi touch just yet!
	domElement.removeEventListener("touchstart", this.onTouchStart, true);
	domElement.removeEventListener("touchend", this.onTouchEnd, true);
	domElement.removeEventListener("touchmove", this.onTouchMove, true);
}

/**
 * updates the state of interactive objects
 *
 * @method update
 * @private
 */
PIXI.InteractionManager.prototype.update = function(forceUpdate)
{
	if(!forceUpdate)
	{
		if(!this.target)return;
	
		// frequency of 30fps??
		var now = Date.now();
		var diff = now - this.last;
		diff = diff * 0.030;// * 30 / 1000
		if(diff < 1)return;
		this.last = now;
		//
	}
	
	var items = this.interactiveItems;
	var length = items.length;
	// ok.. so mouse events??
	// yes for now :)
	// OPTIMSE - how often to check??
	if(this.dirty)
	{
		this.dirty = false;
		
		for (var i=0; i < length; i++) {
		  items[i].interactiveChildren = false;
		}
		
		items.length = 0;
		
		if(this.stage.interactive)
		{
			items.push(this.stage);
			// go through and collect all the objects that are interactive..
			this.collectInteractiveSprite(this.stage, this.stage);
		}
		length = items.length;//update, since this changed
	}
	
	// loop through interactive objects!
	var mode = "default";
				
	for (var i = 0; i < length; i++)
	{
		var item = items[i];
		
		//if(!item.visible)continue;
		
		// OPTIMISATION - only calculate every time if the mousemove function exists..
		// OK so.. does the object have any other interactive functions?
		// hit-test the clip!
		
		if(item.mouseover || item.mouseout || item.buttonMode)
		{
			// ok so there are some functions so lets hit test it..
			item.__hit = this.hitTest(item, this.mouse, 1);
			this.mouse.target = item;
			// ok so deal with interactions..
			// loks like there was a hit!
			if(item.__hit)
			{
				if(item.buttonMode) mode = "pointer";
				
				if(!item.__isOver)
				{
					
					if(item.mouseover)item.mouseover(this.mouse);
					item.__isOver = true;	
				}
			}
			else
			{
				if(item.__isOver)
				{
					// roll out!
					if(item.mouseout)item.mouseout(this.mouse);
					item.__isOver = false;	
				}
			}
		}
		
		// --->
	}
	//update cursor status
	this.updateCursor(mode);
}

PIXI.InteractionManager.prototype.updateCursor = function(mode)
{
	if(mode != this.currentCursor)
	{
		this.currentCursor = mode;
		var cursor = mode == "pointer" ? this.pointerCursor : this.defaultCursor;
		if(typeof cursor == "function")
			cursor();
		else
			this.interactionDOMElement.style.cursor = cursor;
	}
}

/**
 * Is called when the mouse moves accross the renderer element
 *
 * @method onMouseMove
 * @param event {Event} The DOM event of the mouse moving
 * @private
 */
PIXI.InteractionManager.prototype.onMouseMove = function(event)
{
	this.mouse.originalEvent = event || window.event; //IE uses window.event
	// TODO optimize by not check EVERY TIME! maybe half as often? //
	var rect = this.interactionDOMElement.getBoundingClientRect();
	
	this.mouse.global.x = (event.clientX - rect.left) * (this.target.width / rect.width);
	this.mouse.global.y = (event.clientY - rect.top) * ( this.target.height / rect.height);
	
	var length = this.interactiveItems.length;
	var global = this.mouse.global;
	
	
	for (var i = 0; i < length; i++)
	{
		var item = this.interactiveItems[i];
		
		if(item.mousemove)
		{
			//call the function!
			item.mousemove(this.mouse);
		}
	}
}

/**
 * Is called when the mouse button is pressed down on the renderer element
 *
 * @method onMouseDown
 * @param event {Event} The DOM event of a mouse button being pressed down
 * @private
 */
PIXI.InteractionManager.prototype.onMouseDown = function(event)
{
	this.mouse.originalEvent = event || window.event; //IE uses window.event
	
	// loop through inteaction tree...
	// hit test each item! -> 
	// get interactive items under point??
	//stage.__i
	var length = this.interactiveItems.length;
	var global = this.mouse.global;
	
	var index = 0;
	var parent = this.stage;
	
	// while 
	// hit test 
	for (var i = 0; i < length; i++)
	{
		var item = this.interactiveItems[i];
		
		if(item.mousedown || item.click)
		{
			item.__mouseIsDown = true;
			item.__hit = this.hitTest(item, this.mouse);
			
			if(item.__hit)
			{
				//call the function!
				if(item.mousedown)item.mousedown(this.mouse);
				item.__isDown = true;
				
				// just the one!
				if(!item.interactiveChildren)break;
			}
		}
	}
}


PIXI.InteractionManager.prototype.onMouseOut = function(event)
{
	var length = this.interactiveItems.length;
	
	this.updateCursor("default");
				
	for (var i = 0; i < length; i++)
	{
		var item = this.interactiveItems[i];
		
		if(item.__isOver)
		{
			this.mouse.target = item;
			if(item.mouseout)item.mouseout(this.mouse);
			item.__isOver = false;	
		}
	}
	
	if(this.stageOut)
		this.stageOut();
}

PIXI.InteractionManager.prototype.onMouseOver = function(event)
{
	if(this.stageIn)
		this.stageIn();
}

/**
 * Is called when the mouse button is released on the renderer element
 *
 * @method onMouseUp
 * @param event {Event} The DOM event of a mouse button being released
 * @private
 */
PIXI.InteractionManager.prototype.onMouseUp = function(event)
{
	this.mouse.originalEvent = event || window.event; //IE uses window.event
	
	var global = this.mouse.global;
	
	var length = this.interactiveItems.length;
	var up = false;
	
	for (var i = 0; i < length; i++)
	{
		var item = this.interactiveItems[i];
		if(!item) continue;
		
		if(item.mouseup || item.mouseupoutside || item.click)
		{
			item.__hit = this.hitTest(item, this.mouse);
			
			if(item.__hit && !up)
			{
				//call the function!
				if(item.mouseup)
				{
					item.mouseup(this.mouse);
				}
				if(item.__isDown)
				{
					if(item.click)item.click(this.mouse);
				}
				
				if(!item.interactiveChildren)up = true;
			}
			else
			{
				if(item.__isDown)
				{
					if(item.mouseupoutside)item.mouseupoutside(this.mouse);
				}
			}
		
			item.__isDown = false;	
		}
	}
	if(this.stageUp)
		this.stageUp(this.mouse.originalEvent);
}

/**
 * Tests if the current mouse coords hit a sprite
 *
 * @method hitTest
 * @param item {DisplayObject} The displayObject to test for a hit
 * @param interactionData {InteractionData} The interactiondata object to update in the case of a hit
 * @private
 */
PIXI.InteractionManager.prototype.hitTest = function(item, interactionData, vcountOffset)
{
	//I changed the interaction manager to run before the display objects get updated, so here the vcount will always be off by one during update()
	vcountOffset = vcountOffset || 0;
	if(item.vcount + vcountOffset !== PIXI.visibleCount)return false;
	
	var global = interactionData.global;

	var isSprite = (item instanceof PIXI.Sprite),
		worldTransform = item.worldTransform,
		a00 = worldTransform[0], a01 = worldTransform[1], a02 = worldTransform[2],
		a10 = worldTransform[3], a11 = worldTransform[4], a12 = worldTransform[5],
		id = 1 / (a00 * a11 + a01 * -a10),
		x = a11 * id * global.x + -a01 * id * global.y + (a12 * a01 - a02 * a11) * id,
		y = a00 * id * global.y + -a10 * id * global.x + (-a12 * a00 + a02 * a10) * id;

	interactionData.target = item;
	
	//a sprite or display object with a hit area defined
	if(item.hitArea && item.hitArea.contains) {
		if(item.hitArea.contains(x, y)) {
			//if(isSprite)
			interactionData.target = item;

			return true;
		}
		
		return false;
	}
	// a sprite with no hitarea defined
	else if(isSprite)
	{
		var texture = item.texture;
		var width = texture.frame.width,
			height = texture.frame.height;
			
		var aX = item.anchor.x;
		var aY = item.anchor.y;
		if(texture.realSize)
		{
			var rs = texture.realSize;
			aX = (rs.width * aX + rs.x) / width;
			aY = (rs.height * aY + rs.y) / height;
		}
		var x1 = -width * aX,
			y1;
		
		if(x > x1 && x < x1 + width)
		{
			y1 = -height * aY;
		
			if(y > y1 && y < y1 + height)
			{
				// set the target property if a hit is true!
				interactionData.target = item;
				return true;
			}
		}
	}

	var length = item.children.length;
	
	for (var i = 0; i < length; i++)
	{
		var tempItem = item.children[i];
		var hit = this.hitTest(tempItem, interactionData, vcountOffset);
		if(hit)
		{
			// hmm.. TODO SET CORRECT TARGET?
			interactionData.target = item
			return true;
		}
	}

	return false;	
}

/**
 * Is called when a touch is moved accross the renderer element
 *
 * @method onTouchMove
 * @param event {Event} The DOM event of a touch moving accross the renderer view
 * @private
 */
PIXI.InteractionManager.prototype.onTouchMove = function(event)
{
	var rect = this.interactionDOMElement.getBoundingClientRect();
	var changedTouches = event.changedTouches;
	
	var targWidthByRectWidth = (this.target.width / rect.width);
	var targHeightByRectHeight = (this.target.height / rect.height);
	for (var i=0, len = changedTouches.length; i < len; i++) 
	{
		var touchEvent = changedTouches[i];
		var touchData = this.touchs[touchEvent.identifier];
		touchData.originalEvent = event || window.event;
		
		// update the touch position
		touchData.global.x = (touchEvent.clientX - rect.left) * targWidthByRectWidth;
		touchData.global.y = (touchEvent.clientY - rect.top)  * targHeightByRectHeight;
	}
	
	var length = this.interactiveItems.length;
	for (var i = 0; i < length; i++)
	{
		var item = this.interactiveItems[i];
		if(item.touchmove)item.touchmove(touchData);
	}
}

/**
 * Is called when a touch is started on the renderer element
 *
 * @method onTouchStart
 * @param event {Event} The DOM event of a touch starting on the renderer view
 * @private
 */
PIXI.InteractionManager.prototype.onTouchStart = function(event)
{
	var rect = this.interactionDOMElement.getBoundingClientRect();
	
	var changedTouches = event.changedTouches;
	var targWidthByRectWidth = (this.target.width / rect.width);
	var targHeightByRectHeight = (this.target.height / rect.height);
	for (var i=0, len = changedTouches.length; i < len; i++) 
	{
		var touchEvent = changedTouches[i];
		
		var touchData = this.pool.pop();
		if(!touchData)touchData = new PIXI.InteractionData();
		
		touchData.originalEvent =  event || window.event;
		
		this.touchs[touchEvent.identifier] = touchData;
		touchData.global.x = (touchEvent.clientX - rect.left) * targWidthByRectWidth;
		touchData.global.y = (touchEvent.clientY - rect.top)  * targHeightByRectHeight;
		
		var length = this.interactiveItems.length;
		
		for (var j = 0; j < length; j++)
		{
			var item = this.interactiveItems[j];
			
			if(item.touchstart || item.tap)
			{
				item.__hit = this.hitTest(item, touchData);
				
				if(item.__hit)
				{
					//call the function!
					if(item.touchstart)item.touchstart(touchData);
					item.__isDown = true;
					item.__touchData = touchData;
					
					if(!item.interactiveChildren)break;
				}
			}
		}
	}
}

/**
 * Is called when a touch is ended on the renderer element
 *
 * @method onTouchEnd
 * @param event {Event} The DOM event of a touch ending on the renderer view
 * @private
 */
PIXI.InteractionManager.prototype.onTouchEnd = function(event)
{
	//this.mouse.originalEvent = event || window.event; //IE uses window.event
	var rect = this.interactionDOMElement.getBoundingClientRect();
	var changedTouches = event.changedTouches;
	
	var targWidthByRectWidth = (this.target.width / rect.width);
	var targHeightByRectHeight = (this.target.height / rect.height);
	for (var i=0, len = changedTouches.length; i < len; i++) 
	{
		var touchEvent = changedTouches[i];
		var touchData = this.touchs[touchEvent.identifier];
		var up = false;
		touchData.global.x = (touchEvent.clientX - rect.left) * targWidthByRectWidth;
		touchData.global.y = (touchEvent.clientY - rect.top)  * targHeightByRectHeight;
		
		var length = this.interactiveItems.length;
		for (var j = 0; j < length; j++)
		{
			var item = this.interactiveItems[j];
			if(!item) continue;//if for some reason there isn't an item, don't throw an error
			var itemTouchData = item.__touchData; // <-- Here!
			item.__hit = this.hitTest(item, touchData);
		
			if(itemTouchData == touchData)
			{
				// so this one WAS down...
				touchData.originalEvent =  event || window.event;
				// hitTest??
				
				if(item.touchend || item.tap)
				{
					if(item.__hit && !up)
					{
						if(item.touchend)item.touchend(touchData);
						if(item.__isDown)
						{
							if(item.tap)item.tap(touchData);
						}
						
						if(!item.interactiveChildren)up = true;
					}
					else
					{
						if(item.__isDown)
						{
							if(item.touchendoutside)item.touchendoutside(touchData);
						}
					}
					
					item.__isDown = false;
				}
				
				item.__touchData = null;
					
			}
			else
			{
				
			}
		}
		// remove the touch..
		this.pool.push(touchData);
		this.touchs[touchEvent.identifier] = null;
	}
	if(this.stageUp)
		this.stageUp(event);
}

/**
 * Holds all information related to an Interaction event
 *
 * @class InteractionData
 * @constructor
 */
PIXI.InteractionData = function()
{
	/**
	 * This point stores the global coords of where the touch/mouse event happened
	 *
	 * @property global 
	 * @type Point
	 */
	this.global = new PIXI.Point();
	
	// this is here for legacy... but will remove
	this.local = new PIXI.Point();

	/**
	 * The target Sprite that was interacted with
	 *
	 * @property target
	 * @type Sprite
	 */
	this.target;

	/**
	 * When passed to an event handler, this will be the original DOM Event that was captured
	 *
	 * @property originalEvent
	 * @type Event
	 */
	this.originalEvent;
}

/**
 * This will return the local coords of the specified displayObject for this InteractionData
 *
 * @method getLocalPosition
 * @param displayObject {DisplayObject} The DisplayObject that you would like the local coords off
 * @param outPoint {Point} An optional point to use instead of creating a new point
 * @return {Point} A point containing the coords of the InteractionData position relative to the DisplayObject
 */
PIXI.InteractionData.prototype.getLocalPosition = function(displayObject, outPoint)
{
	var worldTransform = displayObject.worldTransform;
	var global = this.global;
	
	// do a cheeky transform to get the mouse coords;
	var a00 = worldTransform[0], a01 = worldTransform[1], a02 = worldTransform[2],
        a10 = worldTransform[3], a11 = worldTransform[4], a12 = worldTransform[5],
        id = 1 / (a00 * a11 + a01 * -a10);
	// set the mouse coords...
	var x = a11 * id * global.x + -a01 * id * global.y + (a12 * a01 - a02 * a11) * id;
	var y = a00 * id * global.y + -a10 * id * global.x + (-a12 * a00 + a02 * a10) * id;
	if(outPoint)
	{
		outPoint.x = x;
		outPoint.y = y;
		return outPoint;
	}
	else
		return new PIXI.Point(x, y);
}

// constructor
PIXI.InteractionData.prototype.constructor = PIXI.InteractionData;
