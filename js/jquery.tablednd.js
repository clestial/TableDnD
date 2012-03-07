/**
 TableDnD plug-in for JQuery, allows you to drag and drop table rows.
 You can set up various options to control how the system will work.
 Copyright (c) Denis Howlett <denish@isocra.com>
 Licensed like jQuery, see http://docs.jquery.com/License.

 Configuration options:

 onDragStyle
   A map of CSS style(s) applied to the dragged row during the drag. There are limitations
   to the styles for a row (e.g. you can't assign a border -- well you can, but it won't be
   displayed). (So instead consider using onDragClass.) The map is as used in the jQuery
   .css(...) function. Default = purple italic text
 onDropStyle
   A map of CSS style(s) applied to the dragged row when it is dropped. Again, there are
   limitations. The style(s) remain in effect. (So again, consider using onDragClass
   which is simply added and then removed on drop.)
 onDragClass
   Name of class (or space-separated classes) added to the dragged row for the duration of
   the drag, and then removed. Classing is more flexible than using onDragStyle since it
   can be inherited by the row cells and other content. The default class is tDnD_whileDrag.
   So to use the default, simply customise this CSS class in your stylesheet.
 onDrop
   Name of a function to be called when the row is dropped. The function must take 2 parameters:
   the table, and the array of row(s) that were dropped. You can work out the new order of the
   rows by using table.rows.
 onDragStart
   Name of a function to be called when a drag starts. The function must take 2 parameters:
   the table, and the array of row(s) which the user has started to drag.
 onRowsChanged
   Name of a function to be called after rows are reordered during a drag though the drag
   has not yet ended. The function takes 3 parameters: the table, the array of row(s) that
   were dropped, and the row upon which the drop occurred.
 onAllowDrop
   Name of a function to be called when drag-cursor is over a non-dragged row. The function
   takes 2 parameters: the array of dragged row(s), and the row under the cursor. The function
   must return true if the dragged row(s) may be dropped there, or else false.
 buttonState
   String comprising acceptable drag-button-index, or combination thereof e.g. any of:
   0,1,2,01,02,12,012
   plus zero or more of 'shift', ctrl', alt', 'meta' (all lower-case). Default '' (i.e. anything)
   Note: browser differences may be a problem (http://unixpapa.com/js/mouse.html)
 serializeRegexp
   The regular expression used to trim row IDs during table serialisation.  Default: /[^\-]*$/
 dragHandle
   Name of a class assigned to draggable cells, one or more of them in each row that is draggable.
   If you specify this class, then only the classed cells will be draggable. Otherwise, the whole
   of each row inside any <tbody></tbody> is draggable.
 containerID
   Id of a scrollable div containing the draggable table. This div is scrolled when the drag
   pointer is near the div's top or bottom. If not provided, the table's parent div, if that is
   scrollable, will be used. Otherwise, the whole window is treated as the scrollable container.

 Other ways to control behaviour:

 Apply class "nodrag" to each row which may not be dragged.
   By itself, this doesn't achieve much, as dragging other rows can change the order anyhow.
   Perhaps useful for first and last rows.
 Apply class "nodrop" to each row onto which dropping is not permitted, and/or which may not
   be re-positioned as a result of dropping elsewhere.

 Inside the onDrop method you can also call $.tableDnD.serialize() this returns a string of the form
 <tableID>[]=<rowID1>&<tableID>[]=<rowID2> that you can send to the server. The table must have an
 ID as must all the rows.

 Other methods:

 $("...").tableDnDSerialize()
 Will serialize and return the serialized string as above, but for each of the matching tables.
 So it can be called from anywhere and isn't dependent on the currentTable being set up correctly
 before calling.

 Known problems:

 History:
 Version 0.2: 2008-02-20 First public version
 Version 0.3: 2008-02-07 Added onDragStart option
                         Made the scroll amount configurable (default is 5 as before)
 Version 0.4: 2008-03-15 Changed the noDrag/noDrop attributes to nodrag/nodrop classes
                         Added onAllowDrop to control dropping
                         Fixed a bug which meant that you couldn't set the scroll amount in both directions
                         Added serialize method
 Version 0.5: 2008-05-16 Changed so that if you specify a dragHandle class it doesn't make the whole row draggable
                         Improved the serialize method to use a default (and settable) regular expression.
                         Added tableDnDupate() and tableDnDSerialize() to be called when you are outside the table
 Version 0.6: 2011-10-16 Added checks for suitable element-types
                         Added real support for multiple <tbody> elements in a table
                         Added support for multi-selection (only for jQuery >= 1.4 and browsers that provide dblclick events)
                         Reduced no. of events processed
                         Added support for specific buttons and states
                         Tolerate pointer 'jiggle' e.g. from in-cell click without triggering a drag
                         Un-dragged rows classed "nodrop" treated as "fixed position", regardless of where drop occurs
                         During drags, apply onDragStyle (if it exists) before, not instead of, onDragClass if that exists
                         Added support for onRowsChanged callback
                         Added missing default onAllowDrop
                         Removed redundant scrollAmount parameter
                         Removed unused default serializeParamName
                         Removed redundant updateTables()
                         (Hopefully, not much tested) improved browser compatibility
 */
(function($) {
 $.tableDnD = {
	/** Pointer to the table being dragged (or only clicked) */
	currentTable: null,
	/** Pointer to the tbody (a DOM element, not a jQuery object) containing the dragObject */
	dragBody: null,
	/** Array of draggable elements (each a table-row DOM element, not a jQuery object) */
	dragObject: null,
	/** Drag started flag */
	dragging: 0,
	/** The current mouse offset */
	mouseOffset: null,
	/** Pointer-device vert-position when drag-start-button was pressed */
	firstY: 0,
	/** Pointer-device previous vert-position (for incremental calculations) */
	oldY: 0,
	/** Auto-scroll-timer id's */
	upid: 0, dnid: 0,

	/** Actually build the structure */
	build: function(options) {
		// Set up the defaults if any
		this.each(function() {
		  if (this.nodeName.toLowerCase() == "table" && $(this).has("tbody").length > 0) {
			// This is bound to each matching table, set up the defaults and override with user options
			this.tableDnDConfig = $.extend({
				onDragStyle: {'color':'purple','font-style':'italic'}, // Map of CSS style(s) applied to a dragged row during drag
				onDropStyle: null, // Map of CSS style(s) applied to a dragged row when dropped
				onDragClass: "tDnD_whileDrag", // Class(es) added to dragged row during drag
				onDrop: null, // Function called after drag ends
				onDragStart: null, // Function called after drag starts
				onRowsChanged: null, // Function called during drag after rows changed
				onAllowDrop: null, // Function called during drag to check whether dropping is allowed
				buttonState: '', // Drag-button-index(ices) and/or modifier(s)
				serializeRegexp: /[^\-]*$/, // Regular expression used to trim row IDs when serializing
				dragHandle: null, // If you give the name of a class here, then only rows containing cell(s) with this class will be draggable
				containerID: null
			}, options || {});
			// Validate containerID
			var container;
			if (this.tableDnDConfig.containerID) {
				container = $('#'+this.tableDnDConfig.containerID);
				if (container.length > 0) {
					var style = container.css('overflow');
					if (!(style == 'auto' || style == 'scroll')) {
						this.tableDnDConfig.containerID = null;
					}
				}
			}
			if (!this.tableDnDConfig.containerID) {
				container = $(this).parent();
				var style = container.css('overflow');
				if ((style == 'auto' || style == 'scroll')) {
					this.tableDnDConfig.containerID = container.attr('id');
					if (this.tableDnDConfig.containerID == "") {
						this.tableDnDConfig.containerID = 'tDnDcontainerID';
						container.attr('id', this.tableDnDConfig.containerID);
					}
				}
			}
			// Handle presses inside the table (better if inside tbody's only, but then we can't access config table data)
			$(this).bind('mousedown', $.tableDnD.btndown);
			// Need sorting provided by later jQuery, when handling > 1 dragrow
			if ($.fn.jquery >= '1.4') {
				$(this).bind('dblclick', $.tableDnD.btnactivate); //too bad if browser does not support this
			}
		  }
		});
		// Handle releases anywhere, drags may end outside the table
		$(document).bind('mouseup', $.tableDnD.btnup);
		// Don't break the chain
		return this;
	},

	/** Get the pointer coordinates from the event (allowing for browser differences) */
	mouseCoords: function(ev) {
		if (ev.pageX || ev.pageY) { //browsers other than IE
			return {x:ev.pageX, y:ev.pageY};
		}
		var d =
		(document.documentElement && document.documentElement.scrollLeft != null) ?
			document.documentElement : document.body;
		return {x:ev.clientX + d.scrollLeft, y:ev.clientY + d.scrollTop};
	},

	/** Given a target element and a mouse event, get the mouse offset from that element.
		To do this we need the element's position and the mouse position */
	getMouseOffset: function(target, ev) {
		ev = ev || window.event;
		var docPos    = this.getPosition(target);
		var mousePos  = this.mouseCoords(ev);
		return {x:mousePos.x - docPos.x, y:mousePos.y - docPos.y};
	},

	/** Get the position of an element by going up the DOM tree and adding up all the offsets */
	getPosition: function(e) {
		var left = 0;
		var top  = 0;
		/** Safari fix -- thanks to Luis Chato for this! */
		if (e.offsetHeight === 0) {
			/** Safari 2 doesn't correctly grab the offsetTop of a table row
			this is detailed here:
			http://jacob.peargrove.com/blog/2006/technical/table-row-offsettop-bug-in-safari/
			the solution is likewise noted there, grab the offset of a table cell in the row - the firstChild.
			note that firefox will return a text node as a first child, so designing a more thorough
			solution may need to take that into account, for now this seems to work in firefox, safari, ie */
			if (e.firstChild) {
				e = e.firstChild; // a table cell
			}
		}

		while (e.offsetParent){
			left += e.offsetLeft;
			top  += e.offsetTop;
			e     = e.offsetParent;
		}

		left += e.offsetLeft;
		top  += e.offsetTop;

		return {x:left, y:top};
	},

	/** Get the vertical scroll of the current window */
	getScrollY: function () {
		var scroll = 0;
		if (window.pageYOffset) {
			scroll = window.pageYOffset;
		} else if (window.scrollY) {
			scroll = window.scrollY;
		} else {
			var t;
			scroll = (((t = document.documentElement) || (t = document.body.parentNode))
						&& typeof t.ScrollTop == 'number' ? t : document.body).ScrollTop;
		}
		return scroll;
	},

	getScrollMaxY: function () {
		if (window.innerHeight && window.scrollMaxY) { // Firefox
			return window.scrollMaxY;
		}
		var innerh = (window.innerHeight) ?
			window.innerHeight:
			document.body.clientHeight;
		if (document.body.scrollHeight > document.body.offsetHeight) { // all but IE, Mac
			return document.body.scrollHeight - innerh;
		} else { // works in IE6 Strict, Mozilla (not FF), Safari
			return document.body.offsetHeight - innerh;
		}
	},

	/** Shift displayed part of table by small amount. Container is a scollable
	    DOM element. usewin (boolean) true = ignore container, scroll window instead
		upward (boolean) true = show more of table-top */
	doScroll: function (container, usewin, upward) {
		var amount;
		if (usewin) {
			var yOffset = this.getScrollY();
			if (upward) {
				//get scroll amount
				if (yOffset > 0) {
					amount = -5;
				} else {
					this.upid = 0;
					return;
				}
			} else {
				//get allowable scroll amount
				var maxScroll = this.getScrollMaxY();
				if (yOffset < maxScroll) {
					amount = 5;
				} else {
					this.dnid = 0;
					return;
				}
			}
			window.scrollBy(0, amount);
		} else {
			amount = $(container).scrollTop();
			if (upward) {
				if (amount > 0) {
					amount -= 1;
				} else {
					this.upid = 0;
					return;
				}
			} else {
				var maxScroll = container.scrollHeight - container.clientHeight;
				if (amount < maxScroll) {
					amount += 1;
				} else {
					this.dnid = 0;
					return;
				}
			}
			container.scrollTop(amount);
		}
		var t = setTimeout(function() {
			$.tableDnD.doScroll(container, usewin, upward);
		}, 20);
		if (upward) {
			this.upid = t;
		} else {
			this.dnid = t;
		}
	},

	/** Cancel current auto-scrolling, if any */
	cancelScroll: function () {
		if (this.upid) {
			window.clearTimeout (this.upid);
			this.upid = 0;
		}
		if (this.dnid) {
			window.clearTimeout (this.dnid);
			this.dnid = 0;
		}
	},

	/** Update display to show row is [to be] dragged */
	showDrag: function (row) {
		var config = $.tableDnD.currentTable.tableDnDConfig;
		if (config.onDropStyle) {
			var clear = {};
			for (var key in config.onDropStyle) {
				clear[key]='';
			}
			$(row).css(clear);
		}
		if (config.onDragStyle) {
			$(row).css(config.onDragStyle);
		}
		if (config.onDragClass) {
			$(row).addClass(config.onDragClass);
		}
	},

	/** Update display to show row is not [to be] dragged */
	hideDrag: function (row) {
		var config = $.tableDnD.currentTable.tableDnDConfig;
		if (config.onDragStyle) {
			var clear = {};
			for (var key in config.onDragStyle) {
				clear[key]='';
			}
			$(row).css(clear);
		}
		if (config.onDragClass) {
			$(row).removeClass(config.onDragClass);
		}
	},

	/** Check whether ev is drag-related and was initiated on a draggable element.
	    If so, return map with the element's tr and tbody ancestors, otherwise false */
	isDraggable: function(table, ev) {
		var config = table.tableDnDConfig;
		if (config.buttonState) {
			var button;
			if (ev.which == null) { // some IE's
				button = (ev.button < 2) ? '0' : ((ev.button === 4) ? '1' : '2');
			} else { // most other browsers
				button = (ev.which < 2) ? '0' : ((ev.which === 2) ? '1' : '2');
			}
			if (config.buttonState.indexOf(button) === -1) return false;
			if (config.buttonState.indexOf('shift') !== -1 && !ev.shiftKey) return false;
			if (config.buttonState.indexOf('ctrl') !== -1 && !ev.ctrlKey) return false;
			if (config.buttonState.indexOf('alt') !== -1 && !ev.altKey) return false;
			if (config.buttonState.indexOf('meta') !== -1 && !ev.metaKey) return false;
		}
		var elem = ev.srcElement || ev.target;
		var name = elem.nodeName.toLowerCase();
		switch (name) {
			case "td":
			case "tr": //header rows get filtered out, later
			 break;
			case "table":
			case "tbody":
			case "thead":
			case "th":
			 return false;
			default:
			 elem = $(elem).closest("td")[0]; //todo handle nested tables
			 if (elem.length === 0) {
				return false;
			 }
			 name = "td";
		}
	
		var row;
		var body;
		if (config.dragHandle) { // We drag rows with specified cells
			if (name=='td' && $(elem).hasClass(config.dragHandle)) 
			  var cells = $(elem);
			else
			  var cells = $("td."+config.dragHandle, elem)

			if (cells.length > 0) {
				row = cells[0].parentNode;
				if (row && !$(row).hasClass("nodrag")) {
					body = row.parentNode;
					if (body && body.nodeName.toLowerCase() == "tbody") {
						return {tb:body, ob:row}; // NOT cells[0], we need the row
					}
				}
			}
		} else { // We drag whole rows
			if (name == "td") {
				row = elem.parentNode;
				if (row && row.nodeName.toLowerCase() != "tr") {
					return false;
				}
			} else {
				row = elem;
		 	}
			if (row && !$(row).hasClass("nodrag")) {
				body = row.parentNode;
				if (body.nodeName.toLowerCase() == "tbody") {
					return {tb:body, ob:row};
				}
			}
	  }
	  return false;
	},

	/** Move-pointer-device event handler */
	pointermove: function(ev) {
		var config;
		var obj = $.tableDnD;
		var mousePos = obj.mouseCoords(ev);
		if (Math.abs(mousePos.y - obj.firstY)<=3) {
			return false; // Don't select text
		}
		config = obj.currentTable.tableDnDConfig;
		// Begin drag if appropriate
		if (!obj.dragging) {
			// Maybe add another row into the drag
			var data = obj.isDraggable (this, ev);
			if (data) {
				if (obj.dragBody) {
					if (obj.dragBody != data.tb) {
						// Remove styling
						$.each(obj.dragObject, function() {
							hideDrag (this);
						});
						obj.dragObject = null;
						obj.dragBody = data.tb;
					}
				} else {
					obj.dragBody = data.tb;
				}
				if (obj.dragObject) {
					if ($.inArray (data.ob, obj.dragObject) === -1) {
						obj.dragObject[obj.dragObject.length] = data.ob;
						obj.showDrag (data.ob);
					}
				} else {
					obj.dragObject = [data.ob];
					obj.showDrag (data.ob);
				}
			}
			if (obj.dragObject == null) { // Nothing draggable now
				obj.btnup(); // Abort so we don't drag the next-traversed row
				return;
			}
			$.unique (obj.dragObject); // Sort in DOM order
			if (data) {
				obj.mouseOffset = obj.getMouseOffset(data.ob, ev);
			} else {
				obj.mouseOffset = obj.getMouseOffset(obj.dragObject[0], ev);
			}

			obj.dragging = 1;
			obj.oldY = obj.firstY - obj.mouseOffset.y;
			// Call the start-handler if there is one
			if (config.onDragStart) {
				config.onDragStart(obj.currentTable, obj.dragObject);
			}
			$(obj.currentTable).css('cursor', 'move');
		}

		var uprlimit;
		var btmlimit;
		var morescroll = false;
		// Preferably, auto-scroll the table-container if needed
		if (config.containerID) {
			var container = $('#'+config.containerID);
			uprlimit = container.offset().top;
			if (mousePos.y < uprlimit + 5) {
				if (obj.upid == 0) {
					obj.doScroll (container[0], false, true);
				}
				morescroll = true;
			} else {
				btmlimit = uprlimit + container.outerHeight(true);
				if (mousePos.y > btmlimit - 5) {
					if (obj.dnid == 0) {
						obj.doScroll (container[0], false, false);
					}
					morescroll = true;
				}
			}
		}
		// Otherwise, auto-scroll the window if needed
		// BUG, TODO, den scrollar inte nedÃ¥t. bara uppÃ¥t. Ibland... Firebug related? Starta och stÃ¤ng firebug sÃ¥ fungerar det.
		if (!morescroll) {
			var uprlimit = obj.getScrollY(); // Vertical pixel-location of the top-left corner of the document
			if (mousePos.y < uprlimit + 5) {
				if (obj.upid == 0) {
					obj.doScroll (window, true, true);
				}
				morescroll = true;
			} else {
				btmlimit = uprlimit + $(window).height();
				if (mousePos.y > btmlimit - 5) {
					if (obj.dnid == 0) {
						obj.doScroll (window, true, false);
					}
					morescroll = true;
				}
			}
		}
		if (!morescroll) {
			obj.cancelScroll();
		}

		var y = mousePos.y - obj.mouseOffset.y;
		if (y != obj.oldY) {
			var upward = (y < obj.oldY);
			// Check whether we're now over a droppable row
			var dropRow = null;
      //var bodyrows = $("> tr", $.tableDnD.dragBody);
			var bodyrows = $("tr:visible", $.tableDnD.currentTable);
			
			for (var i=0; i<bodyrows.length; i++) {
			  var row = bodyrows[i];
			  
				// We're only interested in vertical dimensions, because we only move rows up or down
				var rowY;
				var rowHeight;
				if (row.offsetHeight > 0) {
					rowY = $.tableDnD.getPosition(row).y;
					rowHeight = parseInt(row.offsetHeight)/2; // Dropzone limiter
				} else {
					rowY = $.tableDnD.getPosition(row.firstChild).y;
					rowHeight = parseInt(row.firstChild.offsetHeight)/2;
				}
				if ((y > (rowY - rowHeight)) && (y < (rowY + rowHeight))) { // This one is the row we're over
					if ($.inArray(row, obj.dragObject) === -1) { // No drops onto a dragged row
						var config = $.tableDnD.currentTable.tableDnDConfig;
						if (upward) {
						  if ($(row).hasClass('nodropbefore') || $(bodyrows[i-1]).hasClass('nodropafter')) {
						    break;
						  }
						} else {
						  if ($(row).hasClass('nodropafter') || $(bodyrows[i+1]).hasClass('nodropbefore')) {
						    break;
						  }
						}
						
						if (config.onAllowDrop && config.onAllowDrop(obj.dragObject, row)) {
  						dropRow = row;
						} else if (!$(row).hasClass("nodrop")) {
						// Row has no 'blocking' class, allow the drop (inspired by John Tarr and Famic)
						  dropRow = row;
						}
					}
					break;
				}
				
			}
			// If we're over a droppable row, move the dragged row(s) to there,
			// so that the user sees the effect dynamically
			if (dropRow) {
				// Log fixed-position rows
				var fixed = [];
				$.each(bodyrows, function (indx) {
					if ($(this).hasClass('nodrop') &&
						$.inArray(this, obj.dragObject) == -1) {
						fixed[fixed.length] = [indx, this];
					}
				});
				if (upward) { // Dragging up
					$.each(obj.dragObject, function () {
						if (this != dropRow) {
							$(this).insertBefore(dropRow);
						} else {
							var e = $(this).next();
							if (e.length) {
								dropRow = e[0];
							}
						}
					});
				} else { // Down
					$.each(obj.dragObject, function () {
						if (this != dropRow) {
							$(this).insertAfter(dropRow);
							dropRow = this;
						} else {
							var e = $(this).prev();
							if (e.length) {
								dropRow = e[0];
							}
						}
					});
				}
        /**
        Fan vet hur detta fungerar. FÃ¶r det gÃ¶r det inte.
        
        // Reinstate fixed-position rows (which may have been moved up or down)
        var first = $("> tr", $.tableDnD.dragBody).eq(0);
        // 1 - accumulate fixed rows at start of table
        $.each(fixed, function () {
                if (this[1] != first[0]) {
                        $(this[1]).insertBefore(first);
                }
        });
        // 2 - move fixed rows back
        var src = 0;
        for (var indx = 0; indx < fixed.length; indx++) {
                var pos = fixed[indx][0];
                if (pos > src) {
                        var rows = $("> tr", $.tableDnD.dragBody);
                        $(rows[src]).insertAfter($(rows[pos]));
                } else {
                        src++;
                }
        }
        */
        
				// Call the move-handler if there is one
				if (config.onRowsChanged) {
					config.onRowsChanged (this, obj.dragObject, dropRow);
				}
			}
			// Update the old value
			obj.oldY = y;
		}
		return false;
	},

	/** Press-pointer-device-button event handler */
	btndown: function(ev) {
		var obj = $.tableDnD;
		obj.firstY = obj.mouseCoords(ev).y;// Remember where we started
		obj.currentTable = this;//Remember where to .unbind()

		// Handle dragHandle here, so we can still select text in other rows if dragHandle is defined.
		if (obj.currentTable.tableDnDConfig.dragHandle) {
		  if (!$(ev.target).closest('td').hasClass(obj.currentTable.tableDnDConfig.dragHandle)) {
  		  return true;
		  }
		}
		
		
		// Process pointer-moves inside the table
		$(this).bind('mousemove', obj.pointermove);
		return false; // Prevent text selection during start of drag
	},

	/** Release-pointer-device-button event handler (includes onDrop())*/
	btnup: function() {
		var obj = $.tableDnD;
		obj.firstY = 0;
		$(obj.currentTable).unbind('mousemove', obj.pointermove);
		if (obj.dragging === 1) {
			// This is after drag, not during a doulble-click
			if (obj.dragObject) {
				// Row(s) will have been moved already, so we mainly reset stuff
				obj.cancelScroll();
				obj.oldY = 0;
				$.each(obj.dragObject, function() {
					obj.hideDrag (this);
				});
				var config = obj.currentTable.tableDnDConfig;
				if (config.onDropStyle) {
					$.each(obj.dragObject, function() {
						$(this).css(config.onDropStyle);
					});
				}
				$(obj.currentTable).css('cursor', 'auto');
				// Call the drop-handler if there is one
				if (config.onDrop) {
					config.onDrop(obj.currentTable, obj.dragObject);
				}
				obj.dragObject = null;
				obj.dragBody = null;
			}
			obj.currentTable = null;
			obj.dragging = 0;
		}
	},

	/** Pointer-device-double-click event handler */
	btnactivate: function(ev) {
		var obj = $.tableDnD;
		var data = obj.isDraggable (this, ev);
		if (!data) {
			return;
		}
		if (!obj.currentTable) {
			obj.currentTable = this;
		}
		if (obj.dragBody) {
			if (obj.dragBody != data.tb) {
				// Remove any styling
				$.each(obj.dragObject, function() {
					obj.hideDrag (this);
				});
				obj.dragObject = null;
				obj.dragBody = data.tb;
			}
		} else {
			obj.dragBody = data.tb;
		}
		if (obj.dragObject) {
			var at = $.inArray (data.ob, obj.dragObject);
			if (at !== -1) {
				obj.hideDrag (obj.dragObject[at]);// Remove styling
				if (obj.dragObject.length == 1) {
					obj.dragObject = null;
				} else {
					obj.dragObject.splice (at, 1);
				}
			} else if (!$(data.ob).hasClass("nodrag")) {
				obj.dragObject[obj.dragObject.length] = data.ob;
				obj.showDrag (data.ob);// Add styling
			}
		} else if (!$(data.ob).hasClass("nodrag")) {
			obj.dragObject = [data.ob];
			obj.showDrag (data.ob);
		}
		return false; // Prevent text selection during start of drag
	},

	serialize: function() {
		if ($.tableDnD.currentTable) {
			return $.tableDnD.serializeTable($.tableDnD.currentTable);
		} else {
			return "Error: No table is available for processing";
		}
	},

	serializeTable: function(table) {
		var result = "";
		var tableId = table.id;
		var rows = table.rows;
		for (var i=0; i<rows.length; i++) {
			if (result.length > 0) result += "&";
			var rowId = rows[i].id;
			if (rowId) {
				if (table.tableDnDConfig && table.tableDnDConfig.serializeRegexp) {
					rowId = rowId.match(table.tableDnDConfig.serializeRegexp)[0];
				}
				result += tableId + '[]=' + rowId;
			} else {
				result += tableId + '[]=""';
			}
		}
		return result;
	},

	serializeTables: function() {
		var result = "";
		this.each(function() {
			// this is now bound to each matching table
			result += $.tableDnD.serializeTable(this);
		});
		return result;
	}
 };

 $.fn.extend (
	{
		tableDnD : $.tableDnD.build,
		tableDnDSerialize: $.tableDnD.serializeTables
	}
 );

})( jQuery );
