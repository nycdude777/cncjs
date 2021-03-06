/* This file must be included on the main application page, served by the wireless CNC controller module. */
var cnc = new (function () {

    var _this;
    var _offlinemode = false;

    var _canvas;
    var _drawingcontext;

    const _subscriptions = {};
    const _keymap = {};

    const cmdqueue = [];
    var cmdexecuting = false;

    var _info;
    
     var _msgno = 0;
      
    var _executeNextCommand = function () {

        if (cmdqueue.length < 1) {
            cmdexecuting = false;
            return;
        }

        cmdexecuting = true;

        var cmd = cmdqueue.shift();

        if (cnc.debug) {
            if (!confirm("Execute next command?\n\n" + cmd.message)) {
                return;
            }
        }

        cnc.connect().then(function (socket) {
            console.log(cmd.number + ' ' + cmd.info + ': ' + cmd.message);
            socket.send(cmd.message);
        });

    };

    var _interruptOccured = function () {
        cmdexecuting = false;
        _executeNextCommand();
    };
    

    var _enqueue = function (cmd) {
        cmdqueue.push(cmd);
        if (!cmdexecuting) {
            _executeNextCommand();
        }
    };

    var _milestone = function (id) {
        var cmd = { number: ++_msgno, message: "msg.mls." + id, info: "Milestone reached" };
        if (_offlinemode) {
            $('body').append($e('div.command', $e('span.number', cmd.number), $e('span.message', cmd.message)));
        }
        _enqueue(cmd);
    };

    var _awaitMilestone = function (id) {
        return new Promise((resolve, reject) => {
            cnc.subscribe('milestone:' + id, function () {
                if(cnc.verbose) {alert("Milestone reached: " + id);}
                cnc.unsubscribe('milestone:' + id);
                resolve();
            });
        });
    };

    var _move = function (v, annot) {

        var msg;

        if (cnc.issimulation() || cnc.isoffline()) {
            msg = _info + ': { ' +
                _this.axis.X.getvector(v.x) +
                _this.axis.Y.getvector(v.y) +
                _this.axis.Z.getvector(v.z) +
                ' }';
        }
        else {
            msg = 'm3d.' +
                _this.axis.X.getvector(v.x) + '.' +
                _this.axis.Y.getvector(v.y) + '.' +
                _this.axis.Z.getvector(v.z);
        }
        
        var cmd = { number: ++_msgno, message: msg, info: annot };
        
        if (_offlinemode) {
            $('body').append($e('div.command', $e('span.number', cmd.number), $e('span.message', cmd.message), $e('span.message.annot', cmd.info)));
        }
        else {
            _enqueue(cmd);
        }

        var _newpos = _this.pos.current.copy();
        _newpos.add(v);

        if (_canvas) {
            if (_this.pos.current.z > 0) {
                _drawingcontext.strokeStyle = "#ff0000";
                _drawingcontext.lineWidth = _this.options.tooldiameter * 100;
                _drawingcontext.moveTo(_this.pos.current.x * 100, _this.pos.current.y * 100);
                _drawingcontext.lineTo(_newpos.x * 100, _newpos.y * 100);
                _drawingcontext.stroke();
            }
        }
        _this.pos.current = _newpos;
    };



    return new function () {

        _this = this; //save the instance reference because 'this' will always change

        //enums defined in cnc_enums.js
        _this.STEPSIZE = CNCSTEPSIZE;
        _this.SPEED = CNCSPEED;
        _this.DIRECTION = CNCDIRECTION;

        _this.notify = (msgdata) => {
            if (_subscriptions[msgdata]) {
                _subscriptions[msgdata]();
            }
        };

        _this.connect = CncWSConnect;

        _this.options = {};


        _this.pos = {};
        _this.pos.current = new Vector(0, 0, 0);

        _this.setorigin = () => {
            _this.pos.home = new Vector(0, 0, 0);
            _this.pos.current = new Vector(0, 0, 0);
        };

        var _drawingcontext;
        _this.setcanvas = (canvas) => {
            _canvas = canvas;
            _drawingcontext = _canvas.getContext("2d");
            _drawingcontext.scale(0.1, 0.1);
        };

        _this.endprogram = () => {
            var _drawingcontext = _canvas.getContext("2d");
            _drawingcontext.scale(0.1, 0.1);
        };
        
        _this.findsurface = () => {

            return new Promise((resolve, reject) => {

                if (_offlinemode) {
                    resolve();
                    return;
                }

                cnc.setspeed(cnc.SPEED.FULL);

                cnc.connect().then((socket) => {

                    //setup a message listener and when a message with interrupt id int.surface is received, resolve
                    cnc.subscribe('int.surface', function () {
                        cnc.unsubscribe('int.surface');

                        if (!_this.simulator) {
                            if (!_this.autosurfaceprobe) {
                                if (!confirm('Surface reached!!!\n\nTO CONTINUE:\n1) Remove the Surface Sensors \n2) Power up the tool\n\nbefore pressing continue...')) {
                                    return;
                                }
                            }
                        }

                        cnc.setorigin();

                        resolve();
                    });

                    //set the direction for Z axis to move down its 1
                    var cmd1 = { number: ++_msgno, message: null, info: 'Set Z dir down' };
                    cmd1.message = 'exe.pin.' + _this.axis.Z.pins.dir.toString().padStart(2, '0') + '1';
                    _enqueue(cmd1);
                    
                    //setup pin 7 as input
                    var cmd2 = { number: ++_msgno, message: null, info: 'Set pin 7 as input' };
                    cmd2.message = 'mod.pin.07.1';
                    _enqueue(cmd2); //set pin 7 mode to input (easy to remember: 1 for [I]nput, 0 for [O]utput)

                    //setup an interrupt for condition when pin 7 becomes LOW, this will send a message 'int.surface'
                    //NOTE: Interrupt is automatically removed after condition is met, no need to remove it explicitly
                    var cmd3 = { number: ++_msgno, message: null, info: 'Setup interrupt' };
                    cmd3.message = 'int.pin.07.0.surface';
                    _enqueue(cmd3); //set up interrupt with id 'surface' for condition when pin 7 is low

                    var cmd4 = { number: ++_msgno, message: null, info: 'Find surface' };
                    cmd4.message = 'm3d.' +
                        _this.axis.X.getvector(0) + '.' +
                        _this.axis.Y.getvector(0) + '.' +
                        _this.axis.Z.getvector(100);  //move z far down until the surface is reached, the interrupt should stop it from traveling too far
                                        
                    _enqueue(cmd4);
                    
                });
            });
        }; //requires contact sensor


        _this.tool = { engage: () => { console.log('tool power on'); } };  //tool power on

        _this.move = _move;

        _this.begincut = (annot) => { _this.movezto(_this.options.depth, annot); };          //lower the tool to the cut depth, penetrating the surface
        _this.movex = (dx, annot) => { _this.move(new Vector(dx, 0, 0), annot); };
        _this.movey = (dy, annot) => { _this.move(new Vector(0, dy, 0), annot); };
        _this.movez = (dz, annot) => { _this.move(new Vector(0, 0, dz), annot); };
        _this.moveto = (pos, annot) => { _this.move(_this.pos.current.diff(pos), annot); };
        _this.movexto = (coord, annot) => { _this.move(_this.pos.current.diffx(coord), annot); };
        _this.moveyto = (coord, annot) => { _this.move(_this.pos.current.diffy(coord), annot); };
        _this.movezto = (coord, annot) => { _this.move(_this.pos.current.diffz(coord), annot); };
        
        _this.savepos = (id, pos) => { _this.pos[id] = pos.copy(); };

        _this.subscribe = (id, cb) => { _subscriptions[id] = cb; };
        _this.unsubscribe = (id) => { _subscriptions[id] = null; };

        _this.setoffline = (flag) => {
            _offlinemode = flag;
        };


        //new code
        _this.simulator = false;

        _this.issimulation = () => { return _this.simulator; };
        _this.isoffline = () => { return _offlinemode; };

        _this.executeNextCommand = _executeNextCommand;

        _this.axis = CncInitAxes(); //defined in cnc_axes.js
        CncInitUI(); //defined in cnc_initui.js

        _this.Text = CncText;
        _this.FontSimple = CncFontSimple;
        _this.Point = CncPoint;
        _this.Glyph = CncGlyph;
        _this.Stroke = CncStroke;


        _this.initialize = () => {

            //set default options
            _this.setoptions({
                depth: 0.15,
                retract: 0.4,
                tooldiameter: 0.2
            });

            return new Promise((resolve, reject) => {
                _this.findsurface().then(resolve);
            });
        };

        //end new code


        if (!_this.simulator) {
            _cncsocket.addEventListener("message", CncWSCommMessageHandler);
        }

        _this.setinfo = function (info) {
            _info = info;
        };

        _this.Hole = CncHole;
        _this.Stencil2D = CncStencil2D;

        _this._applyspeed = (speed) => {
            for (var key in _this.axis) {

                _this.axis.X.setstepdivisor(speed.divisor);
                _this.axis.Y.setstepdivisor(speed.divisor);
                _this.axis.Z.setstepdivisor(speed.divisor);
                
                var cmd = { number: ++_msgno, message: null, info: 'Set ' + key + ' step size'};

                cmd.message = 'mot.stp.0.' +
                    _this.axis[key].pins.ms1.toString().padStart(2, "0") + '.' +
                    _this.axis[key].pins.ms2.toString().padStart(2, "0") + '.' +
                    _this.axis[key].pins.ms3.toString().padStart(2, "0") + '.' +
                    speed.step;

                _enqueue(cmd);

            }
        };

        _this.retract = (amount, annot) => {
            var retractionamount = amount || _this.options.retract;
            _this.movezto(-Math.abs(retractionamount), 'Retract ' + retractionamount + 'mm above surface. ' + annot);
        };      //raise the tool

        _this.setspeed = (speed) => {
            _this.options['speed'] = speed;
            _this._applyspeed(speed);
        };

        _this.setoptions = (options) => {
            for (var key in options) {
                _this.options[key] = options[key];
            }
        };

        var _defaultDrillOptions = { speed: _this.SPEED.SIXTEENTH, depth: 4.2, tooldiameter: 4, retract: 2 };
        _this.drill = (options, annot) => {
            var drilloptions = options || _defaultDrillOptions;
            if (!drilloptions.speed) { drilloptions.speed = _defaultDrillOptions.speed; }
            if (!drilloptions.depth) { drilloptions.depth = _defaultDrillOptions.depth; }
            if (!drilloptions.retract) { drilloptions.retract = _defaultDrillOptions.retract; }

            _this._applyspeed(drilloptions.speed);
            _this.movezto(drilloptions.depth, annot);
            
            _this._applyspeed(cnc.SPEED.FULL);            
            _this.retract(drilloptions.retract, 'retract drill bit');

            _this._applyspeed(_this.options.speed);

        };

        _this.movexyto = (coord, annot) => {
            _this.move(_this.pos.current.diffxy(coord), annot);
        };

        _this.milestone = _milestone;
        _this.awaitMilestone = _awaitMilestone;

        _this.interruptOccured = _interruptOccured;
        
        _this.getcommandqueuelength = function(){
            return cmdqueue.length;
        };
        return _this;

    };
})();
