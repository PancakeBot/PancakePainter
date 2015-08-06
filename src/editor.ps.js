/*
 * @file This PaperScript file controls the main PancakeCreator SVG Editor and
 * all importing/exporting of its data.
 */

var values = {
  paths: 5,
  minPoints: 5,
  maxPoints: 15,
  minRadius: 30,
  maxRadius: 90
};

var hitOptions = {
  segments: true,
  stroke: true,
  fill: true,
  tolerance: 5
};

var pancakeShades = [
  '#d7c3b6',
  '#e9c7af',
  '#a15a2c',
  '#4a2814'
];

var strokeWidth = 5;
paper.settings.handleSize = 10;

var drawPath = null;
var selectionRectangle = null;
var selectionRectangleScale = null;
var selectionRectangleScaleNormalized = null;
var selectionRectangleRotation = null;
var segment, path, selectionRectangleSegment;
var movePath = false;
var polygonalDraw = false;
var pencilDraw = false;
var bandLine = null;

createPaths();

function createPaths() {
  var radiusDelta = values.maxRadius - values.minRadius;
  var pointsDelta = values.maxPoints - values.minPoints;
  for (var i = 0; i < values.paths; i++) {
    var radius = values.minRadius + Math.random() * radiusDelta;
    var points = values.minPoints + Math.floor(Math.random() * pointsDelta);
    var path = createBlob(view.size * Point.random(), radius, points);
    var lightness = (Math.random() - 0.5) * 0.4 + 0.4;
    var hue = Math.random() * 360;
    //path.fillColor = { hue: hue, saturation: 1, lightness: lightness };
    path.strokeColor = pancakeShades[0];
    path.strokeWidth = strokeWidth;
  }
  ;
}

function createBlob(center, maxRadius, points) {
  var path = new Path();
  path.closed = true;
  for (var i = 0; i < points; i++) {
    var delta = new Point({
      length: (maxRadius * 0.5) + (Math.random() * maxRadius * 0.5),
      angle: (360 / points) * i
    });
    path.add(center + delta);
  }
  path.smooth();
  return path;
}

function initSelectionRectangle(path) {
  if (selectionRectangle != null)
    selectionRectangle.remove();

  var reset = path.rotation == 0 && path.scaling.x == 1 && path.scaling.y == 1;
  var bounds;

  if (reset) {
    console.log('reset');
    bounds = path.bounds;
    path.pInitialBounds = path.bounds;
  } else {
    console.log('no reset');
    bounds = path.pInitialBounds;
  }
  console.log('bounds: ' + bounds);
  b = bounds.clone().expand(10, 10);

  selectionRectangle = new Path.Rectangle(b);
  selectionRectangle.pivot = selectionRectangle.position;
  selectionRectangle.insert(2, new Point(b.center.x, b.top));
  selectionRectangle.insert(2, new Point(b.center.x, b.top - 25));
  selectionRectangle.insert(2, new Point(b.center.x, b.top));

  if (!reset) {
    selectionRectangle.position = path.bounds.center;
    selectionRectangle.rotation = path.rotation;
    selectionRectangle.scaling = path.scaling;
  }

  selectionRectangle.strokeWidth = 2;
  selectionRectangle.strokeColor = 'blue';
  selectionRectangle.name = "selection rectangle";
  selectionRectangle.selected = true;
  selectionRectangle.ppath = path;
  selectionRectangle.ppath.pivot = selectionRectangle.pivot;
}

function onMouseDown(event) {
  segment = path = null;

  // Continue drawing polygonal (ignores hitTest while on)
  if (drawPath && polygonalDraw) {
    drawPath.add(event.point);

    // Make a new point, delete the first one
    bandLine.segments[0].point = event.point;
    return;
  }

  var hitResult = project.hitTest(event.point, hitOptions);

  // If we didn't hit anything with hitTest...
  if (!hitResult) {
    // Find any items that are Paths (not layers) that contain the point
    var item = getBoundSelection(event.point);

    // If we actually found something, fake a fill hitResult
    if (item) {
      hitResult = {
        type: 'fill', // SURE it is ;)
        item: item
      };
    } else {

      // Create a new drawPath and set its stroke color
      // (only if we're not deselecting something)
      if (project.selectedItems.length === 0) {
        pencilDraw = true;
        drawPath = new Path({
          segments: [event.point],
          strokeColor: pancakeShades[0],
          strokeWidth: strokeWidth
        });
      }

      // Deselect if nothing clicked (feels natural for deselection)
      if (selectionRectangle != null) {
        selectionRectangle.remove();
      }

      return;
    }
  }

  if (event.modifiers.shift) {
    if (hitResult.type == 'segment') {
      hitResult.segment.remove();
    }
    return;
  }

  if (hitResult) {
    console.log(hitResult);
    path = hitResult.item;

    if (hitResult.type == 'segment') {
      if (selectionRectangle != null && path.name == "selection rectangle")
      {
        console.log('selectionRectangle');
        if (hitResult.segment.index >= 2 && hitResult.segment.index <= 4)
        {
          console.log('rotation');
          selectionRectangleRotation = 0;
        }
        else
        {
          console.log('scale');
          selectionRectangleScale = event.point.subtract(selectionRectangle.bounds.center).length / path.scaling.x;
        }
      }
      else
        segment = hitResult.segment;
    } else if (hitResult.type == 'stroke' && path != selectionRectangle) {
      var location = hitResult.location;
      segment = path.insert(location.index + 1, event.point);
      //path.smooth();
    }
    if ((selectionRectangle == null || selectionRectangle.ppath != path) && selectionRectangle != path)
    {
      initSelectionRectangle(path);
    }
  } else { // Nothing hit
    if (selectionRectangle != null)
      selectionRectangle.remove();
  }

  movePath = hitResult.type == 'fill';

  if (movePath)
    project.activeLayer.addChild(hitResult.item);
}

function onMouseMove(event) {
  // Ignore hover effects when drawing
  if (drawPath && polygonalDraw) {
    bandLine.segments[1].point = event.point;
    return;
  }

  project.activeLayer.selected = false;

  if (event.item) {
    event.item.selected = true;
    setCursor('copy');
  } else if (getBoundSelection(event.point)) {
    setCursor('move');
  } else {
    setCursor();
  }

  if (selectionRectangle) {
    selectionRectangle.selected = true;
  }
}

function onMouseDrag(event) {
  if (selectionRectangleScale != null) {
    ratio = event.point.subtract(selectionRectangle.bounds.center).length / selectionRectangleScale;
    scaling = new Point(ratio, ratio);
    selectionRectangle.scaling = scaling;
    selectionRectangle.ppath.scaling = scaling;
    console.log('scaling: ' + selectionRectangle.ppath);
    return;
  } else if (selectionRectangleRotation != null) {
    console.log('rotation: ' + selectionRectangle.ppath);
    rotation = event.point.subtract(selectionRectangle.pivot).angle + 90;
    selectionRectangle.ppath.rotation = rotation;
    selectionRectangle.rotation = rotation;
    return;
  }

  if (drawPath && !polygonalDraw && pencilDraw) {
    // While the user drags the mouse, points are added to the drawPath
    // at the position of the mouse
    drawPath.add(event.point);
  }

  if (segment) {
    segment.point += event.delta;
    //path.smooth();
    initSelectionRectangle(path);
  } else if (path) {
    if (path != selectionRectangle) {
      path.position += event.delta;
      selectionRectangle.position += event.delta;
    } else {
      selectionRectangle.position += event.delta;
      selectionRectangle.ppath.position += event.delta;
    }
  }
}

function onMouseUp(event) {
  selectionRectangleScale = null;
  selectionRectangleRotation = null;

  if (drawPath) {
    if (drawPath.length === 0) {
      polygonalDraw = true;
      pencilDraw = false;
      bandLine = new Path({
        segments: [event.point, event.point],
        strokeColor: 'red',
        strokeWidth: strokeWidth,
        dashArray: [10, 4]
      });
      bandLine.onDoubleClick = cancelPolygonDraw;
      setCursor('copy');
    }

    if (!polygonalDraw && pencilDraw) {
      // When the mouse is released, simplify it:
      drawPath.simplify(10);

      pencilDraw = false;

      // Select the drawPath, so we can see its segments:
      drawPath.fullySelected = true;
      drawPath = null;
    }
  }
}

function onKeyDown(event) {
  if (_.contains(['escape', 'enter'], event.key)) {
    cancelPolygonDraw();
  }

  if (event.key === 'delete' && selectionRectangle) {
    selectionRectangle.ppath.remove();
    selectionRectangle.remove();
    selectionRectangle = null;
  }
}

function cancelPolygonDraw() {
  if (polygonalDraw) {
    polygonalDraw = false;
    drawPath.fullySelected = true;
    drawPath = null;
    bandLine.remove();
    bandLine = null;
    setCursor();
  }
}

function getBoundSelection(point) {
  // Check for items that are overlapping a rect around the event point
  var items = project.getItems({
    overlapping: new Rectangle(point.x - 2, point.y - 2,point.x + 2, point.y + 2)
  });

  var item = null;
  _.each(items, function (i) {
    if (i instanceof Path) {
      if (i.contains(point)) {
        item = i;
      }
    }
  });

  return item;
}

var $editor = $('#editor');
function setCursor(type) {
  if (!type) type = 'default';
  $editor.css('cursor', type);
}

function onResize(event) {
  project.activeLayer.position = view.center;
  view.zoom = scale/2.5;
}

// Editor should be done loading, trigger loadInit
editorLoadedInit();