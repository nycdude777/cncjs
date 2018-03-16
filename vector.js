var Vector = function (x, y, z) {

    var _this;
    
    /*
    Accepts a vector object and passess it through as a return object, adjusting the vector position
    */
    var _add = function (delta) {
        if (!delta.hasOwnProperty('x') || !delta.hasOwnProperty('y') || !delta.hasOwnProperty('z')) {
            throw 'Delta parameter must be a vector or object defining x, y and z values';
        }
        _this.x += delta.x;
        _this.y += delta.y;
        _this.z += delta.z;
        return delta;
    };

    var _subtract = function (delta) {
        if (!delta.hasOwnProperty('x') || !delta.hasOwnProperty('y') || !delta.hasOwnProperty('z')) {
            throw 'Delta parameter must be a vector or object defining x, y and z values.  The original vector is modified, and the delta is returned.';
        }
        _this.x -= delta.x;
        _this.y -= delta.y;
        _this.z -= delta.z;
        return delta;
    };

    var _diff = (v2) => {
        if (!delta.hasOwnProperty('x') || !delta.hasOwnProperty('y') || !delta.hasOwnProperty('z')) {
            throw 'The parameter must be a vector or object defining x, y and z values.  The difference is measured by subtracting the vectory from the supplied parameter.  The difference is returned as new vector.  The original vector remains unmodified';
        }
        return new Vector(v2.x - _this.x, v2.y - _this.y, v2.z - _this.z);

    };

    var _diffx = (x) => { return new Vector(x - _this.x, 0, 0); };
    var _diffy = (y) => { return new Vector(0, y - _this.y, 0); };
    var _diffz = (z) => { return new Vector(0, 0, z - _this.z); };

    var _copy = () => { return new Vector(_this.x, _this.y, _this.z); };

    /*
    Accepts a scalar number representing the change in x, adjusts the x position and returns a new vector object representing the change
    */
    var _addx = function (amount) {
        _this.x += amount;
        return new Vector(amount, 0, 0);
    };

    /*
    Accepts a scalar number representing the change in y, adjusts the y position and returns a new vector object representing the change
    */
    var _addy = function (amount) {
        _this.y += amount;
        return new Vector(0, amount, 0);
    };

    /*
    Accepts a scalar number representing the change in z, adjusts the z position and returns a new vector object representing the change
    */
    var _addz = function (amount) {
        _this.z += amount;
        return new Vector(0, 0, amount);
    };

    return new function () {

        _this = this;

        _this.x = x || 0;
        _this.y = y || 0;
        _this.z = z || 0;

        _this.copy = _copy;

        _this.add = _add;
        _this.addx = _addx;
        _this.addy = _addy;
        _this.addz = _addz;

        _this.subtract = _subtract;

        _this.diff = _diff;
        _this.diffx = _diffx;
        _this.diffy = _diffy;
        _this.diffz = _diffz;

        return _this;
    };
};