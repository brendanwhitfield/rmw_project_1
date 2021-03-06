/*
 * Track.js
 *
 * Class file for an audio track. Each track has its own note grid (this.pattern), and oscillator nodes for each note.
 * This class handles its own UI, so generate your UI HMTL here. Only has one "public" function (beat()) which updates the sound/UI.
 *
 *
 * SIGNAL CHAIN ====================
 *
 *  ____________     ____________     ____________     ____________ 
 * |            |   |            |   |            |   |            |
 * | Oscillator |   | Oscillator |   | Oscillator |   | Oscillator |    ---->    one for each vertical note
 * |____________|   |____________|   |____________|   |____________|
 *       |                |                |                |
 *       |                |                |                |
 *  _____V______     _____V______     _____V______     _____V______ 
 * |            |   |            |   |            |   |            |
 * |    Gain    |   |    Gain    |   |    Gain    |   |    Gain    |    ---->    one for each vertical note
 * |____________|   |____________|   |____________|   |____________|
 *       |                |                |                |
 *       |                |                |                |
 *       |________________|________________|________________|
 *                                 |
 *                                 |
 *                           ______V_______
 *                          |              |
 *                          |  WaveShaper  |
 *                          |______________|
 *                                 |
 *                                 |
 *                           ______V_______
 *                          |              |
 *                          | Master Gain  |
 *                          |______________|
 *                                 |
 *                                 |
 *                           ______V_______
 *                          |              |
 *                          |   Analyzer   |
 *    Other Tracks          |______________|          Other Tracks
 *         |                       |                       |
 *         |                       |                       |
 *         |_______________________|_______________________|
 *                                 |
 *                                 |
 *                _________________V__________________
 *               |                                    |
 *               |            Destination             |
 *               |            (in main.js)            |
 *               |____________________________________|
 *
 *
 */

"use strict";

var Track = function()
{
	var _this = this; //needed because "this" in event handlers refers to the DOM element

	//sound stuff
	this.oscillator_nodes = []; //one oscillator for each pitch
	this.gain_nodes = []; //used to turn notes on & off
	this.compressor_node;
	this.waveShaper_node; //distortion and such
	this.ws_curve;
	this.reverb_node;
	this.analyzer_node;
	this.master_gain_node;

	//running vars
	this.enabled = false;
	this.pattern; // = [][]  (booleans) the actual melody matrix
	this.upperBound = notes;
	this.lowerBound = 0; 

	//display stuff
	this.root;
	this.table;
	this.patternButtons; // = [][]  (table cells) needed for playback color changes
	this.playButton;
	this.deleteButton;
	this.keySelect;
	this.octaveSelect;
	this.scaleSelect;
	this.toneSelect;
	this.shiftLeft;
	this.shiftRight;
	this.volume;
	this.distortion;
	this.canvas;
	this.canvasCtx;
	this.waveform; //Uint8Array
	
	//copy of the return object for deletion
	this.return_obj;



	/*
	 * Public functions
	 */

	//plays the specified beat in the measure
	this.beat = function()
	{
		if(_this.enabled)
		{
			//only loop through the section of notes that turn on and off
			for(var y = _this.lowerBound; y < _this.upperBound; y++)
			{
				var oldBeat = Math.mod((currentBeat - 1), beatsPerMeasure); //used Math.mod() because of possible negative values
				var newState = _this.pattern[y][currentBeat];
				var oldState = _this.pattern[y][oldBeat];
				var currentState = floatToBool(_this.gain_nodes[y].gain.value);

				//turn the oscillators on/off
				if(newState && !currentState)
				{
					_this.gain_nodes[y].gain.value = 1;
				}
				else if(!newState && currentState)
				{
					_this.gain_nodes[y].gain.value = 0;
				}

				//give UI feedback
				if(newState)
				{
					_this.patternButtons[y][currentBeat].className = "play";
				}

				_this.patternButtons[y][oldBeat].className = oldState.toString();
			}
		}
	};

	//general update function, called when an external setting was changed by the user
	this.update = function() {
		var oldEnable = _this.enabled;
		_this.setEnabled(false);
		
		_this.updatePattern();
		_this.updateBounds();
		_this.updateMatrix();
		_this.updateFrequencies();

		_this.setEnabled(oldEnable);
	};


	this.frame = function() {
		var ctx = _this.canvasCtx;
		var waveform = _this.waveform;

		_this.analyzer_node.getByteTimeDomainData(waveform);

		ctx.clearRect(0,0,128,128);
		ctx.beginPath();
		ctx.moveTo(0, waveform[i] / 2);

		for(var i = 1; i < waveform.length; i+=4)
		{
			ctx.lineTo(i, waveform[i] / 2);
		}

		ctx.stroke();
	};


	/*
	 * Private functions
	 */


	//creates and dimensions the pattern buffers according to notes and beatsPerMeasure
	this.updatePattern = function() {

		//check if there's already a pattern there
		if(_this.pattern === undefined)
		{
			//create an empty pattern
			_this.pattern = make2D(notes, beatsPerMeasure, false);
		}
		else if((_this.pattern.length !== beatsPerMeasure) ||
				(_this.pattern[0].length !== notes))
		{
			//its MAAAGICAL!
			_this.pattern = resize2D(_this.pattern,
									 notes,
									 beatsPerMeasure,
									 false,
									 true,
									 false);
		}
	};

	//scans the pattern array and updates the top and bottom bounds (makes the beat() function faster)
	this.updateBounds = function()
	{
		//update the vertical bounds
		var haveNotes = new Array();

		for(var y = 0; y < _this.pattern.length; y++)
		{
			for(var x = 0; x < _this.pattern[y].length; x++)
			{
				if(_this.pattern[y][x])
				{
					haveNotes[y] = true;
				}
				else if(haveNotes[y] == undefined)
				{
					haveNotes[y] = false;
				}
			}
		}

		var i = 0;
		while(!haveNotes[i] && (i < notes)) { i++; }
		_this.lowerBound = i;

		i = notes;
		while(!haveNotes[i] && (i >= 0)) { i--; }
		_this.upperBound = i + 1;

		//turn off the oscillators that are out of bounds
		for(var y = 0; y < _this.lowerBound; y++)
		{
			_this.gain_nodes[y].gain.value = 0;
		}
		for(var y = _this.upperBound; y < notes; y++)
		{
			_this.gain_nodes[y].gain.value = 0;
		}
	};


	//builds the HTML for the button matrix (with values as given by pattern[y][x])
	this.updateMatrix = function() {
		//recreate the table if the size changes
		if((_this.patternButtons === undefined) ||
		   (_this.patternButtons.length !== beatsPerMeasure) ||
		   (_this.patternButtons[0].length !== notes))
		{
			//ditch anything that was there before
			removeChildren(_this.table);

			_this.patternButtons = new Array();

			//build the new table
			for(var y = 0; y < _this.pattern.length; y++)
			{
				//create the table row
				var tr = document.createElement("tr");
				_this.table.appendChild(tr);
				_this.patternButtons[y] = new Array();

				for(var x = 0; x < _this.pattern[y].length; x++)
				{
					//create the table cell
					var td = document.createElement("td");
					tr.appendChild(td);

					//create the button graphic
					var button = document.createElement("div");
					_this.patternButtons[y][x] = button;
					button.setAttribute("x", x);
					button.setAttribute("y", y);
					button.addEventListener("mousedown", _this.matrixClicked);
					button.addEventListener("mouseenter", _this.matrixRollOver);
					td.appendChild(button);
				}
			}
		}

		//make the table match the pattern
		for(var y = 0; y < _this.patternButtons.length; y++)
		{
			for(var x = 0; x < _this.pattern[y].length; x++)
			{
				if(_this.pattern[y][x])
				{
					_this.patternButtons[y][x].className = "true";
				}
				else
				{
					_this.patternButtons[y][x].className = "false";
				}
			}
		}
	};


	/*
	 * Event Handlers for UI elements
	 */

	//enables/disables playback of this track
	this.setEnabled = function(value) {
		if(value === true)
		{
			_this.enabled = true;
		}
		else
		{
			_this.enabled = false;
			
			//in case this is called before things are set up
			if(_this.patternButtons)
			{
				//turn off all the notes, reset the css to look like pattern
				for(var y = 0; y < _this.patternButtons.length; y++)
				{
					_this.gain_nodes[y].gain.value = 0;	
				}

				//update the HMTL to get rid of any playing note lights
				_this.updateMatrix();
			}
			
		}
	};

	//click handler for matrix buttons
	this.matrixClicked = function(e) {
		//prevents chrome text cursor when dragging
		e.preventDefault();
		e.stopPropagation();

		var element = e.target;
		var x = element.getAttribute("x");
		var y = element.getAttribute("y");

		_this.pattern[y][x] = !_this.pattern[y][x];

		if(_this.pattern[y][x])
		{
			element.className = "true";
		}
		else
		{
			element.className = "false";
		}

		_this.updateBounds();
	};

	this.matrixRollOver = function(e) {
		//console.log("rolled");
		//if the mouse is held
		if((e.button === 0) &&(e.buttons >= 1))
		{
			_this.matrixClicked(e);
		}
	}

	this.matrixDrag = function(e) {
		_this.matrixClicked(e);
	};

	//get values from the key, octave and scale <select>, and update the oscillators
	this.updateFrequencies = function(e) {
		//get new information from the select dropdowns
		var key = _this.keySelect.selectedIndex;
		var octave = octaves[_this.octaveSelect.selectedIndex].octave;
		var scale = _this.scaleSelect.selectedIndex;

		//update the oscillators with their new frequencies
		for(var y = 0; y < notes; y++)
		{							//bottom = note 0
			_this.oscillator_nodes[invert(y, notes)].frequency.value = getFrequency(y, key, octave, scale);
		}
	};

	//reads the UI, and sets the oscillators with the correct periodicWave
	this.updateTone = function(e) {
		var type = tones[_this.toneSelect.selectedIndex].name.toLowerCase();
		for(var y = 0; y < notes; y++)
		{						   //bottom = note 0
			_this.oscillator_nodes[invert(y, notes)].type = type;
		}
	};
	
	// Shifts the matrix left or right
	this.shiftMatrix = function(e) {
		// Create an empty array
		var tempMatrix = new Array();
		for(var y = 0; y < _this.patternButtons.length; y++)
		{
			tempMatrix[y] = new Array(); // 2d Array
			for(var x = 0; x < _this.pattern[y].length; x++)
			{
				// Change the temp matrix to reflect the updated pattern
				if(e.target.className.indexOf('shiftLeft') > -1)
				{
					if(x === 0)
						tempMatrix[y][_this.pattern[y].length - 1] = _this.pattern[y][x];
					else
						tempMatrix[y][x - 1] = _this.pattern[y][x];
				}
				else if(e.target.className.indexOf('shiftRight') > -1)
				{
					if(x === _this.pattern[y].length - 1)
						tempMatrix[y][0] = _this.pattern[y][x];
					else
						tempMatrix[y][x + 1] = _this.pattern[y][x];
				}
			}
			
		}
		
		// set the pattern matrix to the temp
		_this.pattern = tempMatrix;
		
		// update the matrix
		_this.updateMatrix();
	};

	this.updateVolume = function(e) {
		_this.master_gain_node.gain.value = e.target.value;
	};

	this.updateDistortion = function(e) {
		setDistortion(_this.ws_curve, e.target.value);
		_this.waveShaper_node.curve = _this.ws_curve;
	};

	this.toggleEnabled = function(e) {
		_this.setEnabled(!_this.enabled);
		e.target.classList.toggle("true");
	};

	//self destruct in five, four, three, tw**BOOM**
	this.destruct = function(e) {
		document.querySelector("#tracks").removeChild(_this.root);

		//delete/disconnect audio objects
		for(var y = 0; y < notes; y++)
		{
			_this.oscillator_nodes[y].stop(0); //shut-up
			_this.oscillator_nodes[y] = undefined; //destroy all the evidence
			_this.gain_nodes[y] = undefined;
		}

		_this.compressor_node = undefined;
		_this.waveShaper_node = undefined;
		_this.analyzer_node = undefined;
		_this.master_gain_node = undefined;
		
		_this.enabled = false;

		//delete from tracks list
		deleteTrack(_this.return_obj);
	};



	//constructor--------------------------------------------------------------
		
		//SOUND-------------------------------------------

		this.compressor_node =  audioCtx.createDynamicsCompressor();
		this.waveShaper_node =  audioCtx.createWaveShaper();
		this.analyzer_node =    audioCtx.createAnalyser();
		this.master_gain_node = audioCtx.createGain();

		for(var y = 0; y < notes; y++)
		{
			this.oscillator_nodes[y] = audioCtx.createOscillator();
			this.gain_nodes[y] = audioCtx.createGain();

			this.oscillator_nodes[y].connect(this.gain_nodes[y]);
			this.gain_nodes[y].connect(this.compressor_node);

			//turn things off BEFORE the oscillators are started
			this.gain_nodes[y].gain.value = 0;
			this.oscillator_nodes[y].start(0);
		}

		//zero out the waveshaper
		this.ws_curve = new Float32Array(2048);
		setDistortion(this.ws_curve, 0);
		this.waveShaper_node.curve = this.ws_curve;

		//set the size of the analyzer
		this.analyzer_node.fftSize = 128;
		this.waveform = new Uint8Array(this.analyzer_node.fftSize);

		//connect the rest of the signal chain
		this.compressor_node.connect(this.waveShaper_node);
		this.waveShaper_node.connect(this.master_gain_node);
		this.master_gain_node.connect(this.analyzer_node);
		this.analyzer_node.connect(destination_node);


		//HTML--------------------------------------------

		//grab the template HMTL for a track object
		this.root = document.querySelector("#templates .track").cloneNode(true);

		this.table = this.root.querySelector("table");
		this.playButton = this.root.querySelector(".options .playButton");		
		this.deleteButton = this.root.querySelector(".options .deleteButton");
		this.keySelect = this.root.querySelector(".options .key");
		this.octaveSelect = this.root.querySelector(".options .octave");
		this.scaleSelect = this.root.querySelector(".options .scale");
		this.toneSelect = this.root.querySelector(".options .tone");
		this.shiftLeft = this.root.querySelector(".shiftLeft");
		this.shiftRight = this.root.querySelector(".shiftRight");
		this.canvas = this.root.querySelector("canvas");
		this.volume = this.root.querySelector(".volume");
		this.distortion = this.root.querySelector(".distortion");
		
		fillSelect(this.keySelect, keys, 0);
		fillSelect(this.octaveSelect, octaves, 3);
		fillSelect(this.scaleSelect, scales, 1);
		fillSelect(this.toneSelect, tones, 0);

		this.table.addEventListener("mousemove", this.matrixMove);
		this.playButton.addEventListener("click", this.toggleEnabled);
		this.deleteButton.addEventListener("click", this.destruct);
		this.keySelect.addEventListener("change", this.updateFrequencies);
		this.octaveSelect.addEventListener("change", this.updateFrequencies);
		this.scaleSelect.addEventListener("change", this.updateFrequencies);
		this.toneSelect.addEventListener("change", this.updateTone);
		this.shiftLeft.addEventListener("click", this.shiftMatrix);
		this.shiftRight.addEventListener("click", this.shiftMatrix);
		this.volume.addEventListener("change", this.updateVolume);
		this.distortion.addEventListener("change", this.updateDistortion);
		
		this.canvasCtx = this.canvas.getContext("2d");
		this.canvasCtx.strokeStyle = "white";

		//make the sequencer matrix & setup the oscillators with their frequencies
		this.update();

		//add the finished track to the page
		document.querySelector("#tracks").appendChild(this.root);
		this.setEnabled(true);

	//end constructor----------------------------------------------------------

	//return only public functions
	this.return_obj = {
		beat: this.beat,
		update: this.update,
		frame: this.frame
	};

	return this.return_obj;
};
