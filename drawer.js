;(function() {
"use strict";

class Point {
	constructor(x,y,z)
	{
		if (z === undefined)
			z = 0;
		this.data = [x, y, z, 1];
	}
	get x() {return this.data[0];}
	get y()	{return this.data[1];}
	get z()	{return this.data[2];}

	set x(v) { this.data[0] = v;}
	set y(v) { this.data[1] = v;}
	set z(v) { this.data[2] = v;}

	clone() { return new Point(this.data[0], this.data[1], this.data[2]); }

	appTransform(m)
	{
		let newP = new Point(0, 0, 0);
		for (let r = 0; r < (4-1); ++r)
		{
			let s = 0;
			for (let c = 0; c < 4; ++c)
				s += m.data[r][c] * this.data[c];
			newP.data[r] = s;
		}
		return newP;
	}
};
function isArray4Dem(array)
{
	if (array.length != 4)
		return false;
	for (let i = 0; i < 4; ++i)
		if (array[i].length != 4)
			return false;
	return true;
}
class Matrix {
	//special matrix for graphics
	constructor(array, makeCopy)
	{
		if (makeCopy === false)
			this.data = array;
		else
		{
			if (!isArray4Dem(array))
				throw new Error("Initizialier is not 4matrix!");
			this.data = [];
			for (let i = 0; i < 4; ++i)
				this.data[i] = array[i].slice();
		}
	}

	static mul(m1, m2)
	{
		function mulRowCol(r,row)
		{
			for (let c = 0; c < 4; ++c)
			{
				let s = 0;
				for (let i = 0; i < 4; ++i)
					s += m1.data[r][i] * m2.data[i][c];
				row[c] = s;
			}
		}
		let m3 = [[0, 0, 0, 0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
		for (let r = 0; r < 4; ++r)
			mulRowCol(r,m3[r]);
		return new Matrix(m3, false);
	}
	static Move(dx, dy, dz)
	{
		return new Matrix([[1, 0, 0, dx],[0, 1, 0, dy],[0, 0, 1, dz],[0, 0, 0, 1]]);
	}
	static Scale(sx, sy, sz)
	{
		return new Matrix([[sx, 0, 0, 0],[0, sy, 0, 0],[0, 0, sz, 0],[0, 0, 0, 1]]);
	}
	static Identity()
	{
		return new Matrix([[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]);
	}
	static RotateZ(a)
	{
		return new Matrix([[Math.cos(a), -Math.sin(a), 0, 0], [Math.sin(a), Math.cos(a), 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]);
	}
	static RotateY(a)
	{
		return new Matrix([[Math.cos(a), 0, Math.sin(a), 0], [0, 1, 0, 0], [-Math.sin(a), 0, Math.cos(a), 0], [0, 0, 0, 1]]);
	}
	static RotateX(a)
	{
		return new Matrix([[1, 0, 0, 0],[0, Math.cos(a), -Math.sin(a), 0], [0, Math.sin(a), Math.cos(a), 0], [0, 0, 0, 1]]);
	}
};
function bresLine(ctx, x0, y0, x1, y1) 
{
	x0 = Math.round(x0);
	y0 = Math.round(y0);
	x1 = Math.round(x1);
	y1 = Math.round(y1);
	let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
	let dy = Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1; 
	let err = (dx>dy ? dx : -dy)/2;
 
	while (true) 
	{
		ctx.fillRect(x0,y0,1,1);
		if (x0 === x1 && y0 === y1)
			break;
	
		let e2 = err;

		if (e2 > -dx) 
		{ 
			err -= dy; 
			x0 += sx; 
		}
		if (e2 < dy) 
		{ 
			err += dx; 
			y0 += sy; 
		}
	}
}
function bresCircle(ctx, x0, y0, R)
{
	function dot(x,y) { ctx.fillRect(x,y,1,1); }
	let x = 0;
	let y = R;
	let delta = 1 - 2*R;
	let error = 0;
	while (y >= 0)
	{
		dot(x0 + x, y0 + y);
		dot(x0 + x, y0 - y);
		dot(x0 - x, y0 + y);
		dot(x0 - x, y0 - y);
		error = 2 * (delta + y) - 1;
		if ((delta < 0) && (error <= 0))
		{
			delta += 2 * (++x) + 1;
			continue;
		}
		error = 2 * (delta - x) - 1;
		if ((delta > 0) && (error > 0))
		{
			delta += 1 - 2 * (--y);
			continue;
		}
		x++;
		delta += 2 * (x - y);
		y--;
	}
}
function findFramingRect(polygon)
{
	let xMax = null, xMin = null, yMax = null, yMin = null;
	xMax = xMin = polygon[0].x;
	yMax = yMin = polygon[0].y;

	for (let i = 1; i < polygon.length - 1; ++i)
	{
		if (polygon[i].x > xMax)
			xMax = polygon[i].x;
		else if (polygon[i].x < xMin)
			xMin = polygon[i].x;

		if (polygon[i].y > yMax)
			yMax = polygon[i].y;
		else if (polygon[i].y < yMin)
			yMin = polygon[i].y;
	}
	return [xMin, yMin, xMax, yMax];
}
function polygonFill(ctx, polygon)
{
	let rect = findFramingRect(polygon);
	function isInSegment(c, a, b)
	{
		if ((c < a && c < b) || (c > a && c > b))
			return false;
		return true;
	}
	function isInYBound(y, a, b)
	{
		if (a > b)
			[a, b] = [b, a];
		if (y < a || y > b)
			return false;
		if (y == b)
			return false;
		return true;
	}
	function getLines(polygon)
	{
		let lines = [];
		function pushLine(i1, i2)
		{
			let x0 = polygon[i1].x, y0 = polygon[i1].y;
		       	let x1 = polygon[i2].x, y1 = polygon[i2].y;
			let k = (y1 - y0)/(x1 - x0);
			let b = null;
			let type = null;
			if (x1 - x0 != 0)
			{
				b = y1 - k*x1;
				if (k == 0)
					type = 'y';
			}
			else
				type = 'x';
			lines.push({type: type, x0: x0, x1: x1, y0: y0, y1: y1, k: k, b: b});
		}
		for (let i = 1; i < polygon.length; ++i)
			pushLine(i, i-1);
		pushLine(polygon.length-1, 0);
		return lines;
	}
	function findIntersection(lines, y)
	{
		let list = [];
		for (let i = 0; i < lines.length; ++i)
		{
			let line = lines[i];
			switch(line.type)
			{
				case 'y':
					break;
				case 'x':
					if (!isInYBound(y, line.y0, line.y1))
						continue;
					list.push({x: line.x0, y: y});
					break;
				default:
					if (!isInYBound(y, line.y0, line.y1))
						continue;
					let x = Math.round((y - line.b)/line.k);
					if (!isInSegment(x, line.x0, line.x1))
						continue;
					list.push({x: x, y: y});
					break;
			}
		}
		list.sort(function(a,b) { if(a.x < b.x) return -1; else if (a.x > b.x) return 1; return 0; })
		return list;
	}
	function fillList(list)
	{
		if (list.length % 2 != 0)
		{
			alert("Wrong list!");
			return;
		}
		for (let i = 1; i < list.length; i+=2)
		{
			let l = list[i].x - list[i-1].x + 1;
			if (l <= 0)
				continue;
			ctx.fillRect(list[i-1].x, list[i-1].y, l, 1);
		}
	}
	
	let yMin = rect[1];
	let yMax = rect[3];
	let lines = getLines(polygon);
	for (let y = yMin; y <= yMax; ++y)
	{
		let list = findIntersection(lines, y);
		fillList(list);
	}
}
function fillRegionByPoint(ctx, x, y, w, h)
{
	function isWhite(x, y)
	{
		let pixel = ctx.getImageData(x, y, 1, 1).data;
		//let s = pixel[0] + pixel[1] + pixel[2];
		//if (s > 740)
		if (pixel[0] == 255 && pixel[1] == 255 && pixel[2] == 255)
			return true;
		return false;
	}
	function isValidPos(x,y)
	{
		if (x < 0 || x > w || y < 0 || y > h)
			return false;
		return true;
	}

	let stack = [ [x, y] ];
	while (stack.length != 0)
	{
		let point = stack.pop();
		let x = point[0], y = point[1];

		if (!isValidPos(x,y))
			continue;
		if (!isWhite(x,y))
			continue;;

		ctx.fillRect(x, y, 1, 1);
		stack.push([x+1, y]);
		stack.push([x, y+1]);
		stack.push([x-1, y]);
		stack.push([x, y-1]);
	}
}
function bezierCurve(ctx, points)
{
	function getPointOnLine(t, x0, y0, z0, x1, y1, z1)
	{
		let newX = (x1 - x0)*t + x0;
		let newY = (y1 - y0)*t + y0;
		let newZ = (z1 - z0)*t + z0;
		return new Point(newX, newY, newZ);
	}
	function getPointOnCurve(t, points)
	{
		if (points.length == 2)
			return getPointOnLine(t, points[0].x, points[0].y, points[0].z,  points[1].x, points[1].y, points[1].z);

		let newPoints = [];
		for (let i = 1; i < points.length; ++i)
			newPoints.push(getPointOnLine(t, points[i-1].x, points[i-1].y, points[i-1].z,  points[i].x, points[i].y, points[i].z));

		return getPointOnCurve(t, newPoints);
	}

	let dt = 0.01;
	let point = getPointOnCurve(0, points);
	for (let t = dt; t <= 1; t += dt)
	{
		let newPoint = getPointOnCurve(t, points);
		bresLine(ctx, Math.round(point.x), Math.round(point.y), Math.round(newPoint.x), Math.round(newPoint.y));
		point = newPoint;
	}
}
function clipLineByRect(rect, line)
{
	let left 	= 1;
	let right 	= 1 << 1;
	let down	= 1 << 2;
	let up		= 1 << 3;
	
	function getPointBit(x, y)
	{
		let b = 0;
		if (x < rect.xl)
			b |= left;
		else if (x > rect.xr)
			b |= right;

		if (y > rect.yb)
			b |= down;
		else if (y < rect.yt)
			b |= up;
		return b;
	}
	function getLineBit(line)
	{
		return [getPointBit(line[0].x, line[0].y), getPointBit(line[1].x, line[1].y)];
	}
	function clipLine(line)
	{
		let bits = getLineBit(line);
		while(bits[0] | bits[1])
		{
			if (bits[0] & bits[1])
				return null;

			let x = null, y = null;
			let c = null

			if (bits[0])
			{
				c = bits[0]
				x = line[0].x, y = line[0].y;
			}
			else
			{
				c = bits[1]
				x = line[1].x, y = line[1].y;
			}

			if (c & left)
			{
				y += (line[0].y - line[1].y) * (rect.xl - x) / (line[0].x - line[1].x);
				x = rect.xl;
			}
			else if (c & right)
			{
				y += (line[0].y - line[1].y) * (rect.xr - x) / (line[0].x - line[1].x);
				x = rect.xr;
			}
			else if (c & up)
			{
				x += (line[0].x - line[1].x) * (rect.yt - y) / (line[0].y - line[1].y);
				y = rect.yt;
			}
			else if (c & down)
			{
				x += (line[0].x - line[1].x) * (rect.yb - y) / (line[0].y - line[1].y);
				y = rect.yb;
			}

			if (c == bits[0])
			{
				line[0].x = Math.round(x); line[0].y = Math.round(y);
			}
			else
			{
				line[1].x = Math.round(x); line[1].y = Math.round(y);
			}
			bits = getLineBit(line);
		}
		return line;
	}

	return clipLine(line);
}

/*
 * lines - набор линий. Состоят из массива 0 - первая точка, 1 - последняя, 2 - цвет
 *
*/
let ENUM_COUNTER = 0
const LINE 		= ENUM_COUNTER++;
const POLYLINE 		= ENUM_COUNTER++;
const CIRCLE 		= ENUM_COUNTER++;
const CIRCLES 		= ENUM_COUNTER++;
const POLYGON 		= ENUM_COUNTER++;
const BEZIER_CURVE	= ENUM_COUNTER++;

class Rect {
	constructor(p1, p2)
	{
		this.p1 = p1;
		this.p2 = p2;
	}
	get xl() { return this.p1.x; }
	get xr() { return this.p2.x; }
	get yt() { return this.p1.y; }
	get yb() { return this.p2.y; }
};
class Circle {
	constructor(p, r)
	{
		this.p = p;
		this.r = r;
	}
};
class Figure 
{
	constructor(type, color, points)
	{
		this.type = type;
		this.color = color;
		this.points = points;
		this.fillColor = "TRANSPARENT";
	}
};
class Drawer
{
	constructor(canvas)
	{
		this._canvas		= canvas;
		this._ctx 		= canvas.getContext('2d');
		this._width 		= canvas.width;
		this._height		= canvas.height;

		this._color 		= "#000000";
		this._clearColor	= "#FFFFFF";
		this._fillColor		= "TRANSPARENT";

		this._figures = [];
		this._clipRect 		= new Rect(new Point(0,0), new Point(canvas.width, canvas.height));

	}

	set color(c) 		{this._color = c;}
	get color()  		{return this._clearColor}

	set clearColor(c) 	{this._clearColor = c;}
	get clearColor()  	{return this._color}

	set fillColor(c) 	{this._fillColor = c;}
	get fillColor()  	{return this._fillColor}

	set clipRect(r)		{this._clipRect = r;}

	line3(x0, y0, z0, x1, y1, z1)
	{
		let p1 = new Point(x0, y0, z0);
		let p2 = new Point(x1, y1, z1);
		this._figures.push(new Figure(LINE, this._color, [p1, p2]));
	}
	line2(x0, y0, x1, y1)
	{
		this.line3(x0, y0, 0, x1, y1, 0);
	}
	line(p1, p2)
	{
		this._figures.push(new Figure(LINE, this._color, [p1.clone(), p2.clone()]));
	}
	circle3(x, y, z, R)
	{
		let p = new Point(x, y, z);
		this._figures.push(new Figure(CIRCLE, this._color, [p, R]));
	}
	circle2(x, y, R)
	{
		this.circle3(x, y, 0, R);
	}
	circlep(p1, r)
	{
		this._figures.push(new Figure(CIRCLE, this._color, [p1, r]));
	}
	circle(c)
	{
		this._figures.push(new Figure(CIRCLE, this._color, [c.p, c.r]));
	}
	circles(p1r)
	{
		this._figures.push(new Figure(CIRCLES, this._color, p1r));
	}
	polyline(points)
	{
		this._figures.push(new Figure(POLYLINE, this._color, points));
	}
	polygon(points)
	{
		let fig = new Figure(POLYGON, this._color, points);
		fig.fillColor = this._fillColor;
		this._figures.push(fig);
	}
	rect(r)
	{
		let plt = r.p1;
		let prb = r.p2;
		let prt = new Point(prb.x, plt.y);
		let plb = new Point(plt.x, prb.y);
		this.polygon([plt, prt, prb, plb]);	
	}
	bezier(points)
	{
		let newPoints = [];
		for (let i = 0; i < points.length; ++i)
			newPoints[i] = points[i].clone();
		this._figures.push(new Figure(BEZIER_CURVE, this._color, newPoints));
	}

	draw()
	{
		for (let i = 0; i < this._figures.length; ++i)
		{
			let fig = this._figures[i];
			this._ctx.fillStyle = fig.color;
			switch (fig.type)
			{
				case LINE:
				{
					let line = clipLineByRect(this._clipRect, fig.points);
					if (line === null)
						break;
					let p1 = line[0], p2 = line[1];
					bresLine(this._ctx, p1.x, p1.y, p2.x, p2.y);
					break;
				}
				case POLYLINE:
				{
					let ps = fig.points;
					for (let i = 1; i < ps.length; ++i)
						bresLine(this._ctx, ps[i].x, ps[i].y, ps[i-1].x, ps[i-1].y);
					break;
				}
				case CIRCLE:
				{
					let p = fig.points[0], r = fig.points[1];
					bresCircle(this._ctx, p.x, p.y, r);
					break;
				}
				case CIRCLES:
				{
					let ps = fig.points;
					for (let i = 0; i < ps.length; i+=2)
						bresCircle(this._ctx, ps[i].x, ps[i].y, ps[i+1]);
					break;
				}
				case POLYGON:
				{
					let ps = fig.points;
					if (fig.fillColor != "TRANSPARENT")
					{
						this._ctx.fillStyle = fig.fillColor;
						polygonFill(this._ctx, ps);
					}
					this._ctx.fillStyle = fig.color;
					for (let i = 1; i < ps.length; ++i)
						bresLine(this._ctx, ps[i].x, ps[i].y, ps[i-1].x, ps[i-1].y);
					let li = ps.length - 1;
					bresLine(this._ctx, ps[li].x, ps[li].y, ps[0].x, ps[0].y);
					break;
				}
				case BEZIER_CURVE:
				{
					let ps = fig.points;

					if (ps.length < 2)
						break;
					bezierCurve(this._ctx, ps);
					break;
				}
				default:
					break;
			}
		}
		this._figures = [];
	}
	fillRegion(p)
	{
		this._ctx.fillStyle = this._fillColor;	
		fillRegionByPoint(this._ctx, p.x, p.y, this._width, this._height);
	}
	clear() 
	{
		//clear
		this._ctx.fillStyle = this._clearColor;
		this._ctx.fillRect(0, 0, this._width, this._height);
	}
	redraw()
	{
		this.clear();
		this.draw();
	}
	static evklidR(x0, y0, x1, y1)
	{
		return Math.sqrt(Math.pow(x0-x1,2) + Math.pow(y0-y1,2));
	}
};


Drawer.Point 		= Point;
Drawer.Rect		= Rect; 
Drawer.Circle		= Circle; 
Drawer.Matrix		= Matrix;
window.Drawer 		= Drawer;

})();
