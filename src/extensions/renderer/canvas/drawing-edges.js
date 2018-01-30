/* global Path2D */

let util = require('../../../util');

let CRp = {};

CRp.drawEdge = function( context, edge, shiftToOriginWithBb, drawLabel ){
  let r = this;
  let rs = edge._private.rscratch;
  let usePaths = r.usePaths();

  // if bezier ctrl pts can not be calculated, then die
  if( rs.badLine || isNaN(rs.allpts[0]) ){ // isNaN in case edge is impossible and browser bugs (e.g. safari)
    return;
  }

  if( !edge.visible() ){ return; }

  let bb;
  if( shiftToOriginWithBb ){
    bb = shiftToOriginWithBb;

    context.translate( -bb.x1, -bb.y1 );
  }

  let overlayPadding = edge.pstyle('overlay-padding').pfValue;
  let overlayWidth = 2 * overlayPadding;
  let overlayOpacity = edge.pstyle('overlay-opacity').value;
  let overlayColor = edge.pstyle('overlay-color').value;
  let lineColor = edge.pstyle('line-color').value;
  let opacity = edge.pstyle('opacity').value;
  let lineStyle = edge.pstyle('line-style').value;
  let edgeWidth = edge.pstyle('width').pfValue;
  let lineCap = edge.pstyle('line-cap').value;
  let lineColorStyle = edge.pstyle('line-color-style').value;

  let drawLine = ( strokeOpacity = opacity ) => {
    context.lineWidth = edgeWidth;
    context.lineCap = lineCap;

    if (lineColorStyle === 'linear-gradient' || lineColorStyle === 'radial-gradient') {
      let gradientStop1Color = edge.pstyle('line-gradient-stop-1-color').value,
        gradientStop2Color = edge.pstyle('line-gradient-stop-2-color').value;

      r.strokeStyle(context, {
        gradient: lineColorStyle,
        ele: edge,
        colors: [gradientStop1Color, gradientStop2Color],
        opacity: strokeOpacity
      })
    }
    else {
      r.strokeStyle(context, false, lineColor[0], lineColor[1], lineColor[2], strokeOpacity);
    }
    
    r.drawEdgePath(
      edge,
      context,
      rs.allpts,
      lineStyle
    );

    context.lineCap = 'butt'; // reset for other drawing functions
  };

  let drawOverlay = ( strokeOpacity = overlayOpacity ) => {
    context.lineWidth = overlayWidth;

    if( rs.edgeType === 'self' && !usePaths ){
      context.lineCap = 'butt';
    } else {
      context.lineCap = 'round';
    }

    r.strokeStyle( context, false, overlayColor[0], overlayColor[1], overlayColor[2], strokeOpacity );

    r.drawEdgePath(
      edge,
      context,
      rs.allpts,
      'solid'
    );
  };

  let drawArrows = ( arrowOpacity = opacity ) => {
    r.drawArrowheads( context, edge, arrowOpacity );
  };

  let drawText = () => {
    r.drawElementText( context, edge, drawLabel );
  };

  context.lineJoin = 'round';

  let ghost = edge.pstyle('ghost').value === 'yes';

  if( ghost ){
    let gx = edge.pstyle('ghost-offset-x').pfValue;
    let gy = edge.pstyle('ghost-offset-y').pfValue;
    let ghostOpacity = edge.pstyle('ghost-opacity').value;
    let effectiveGhostOpacity = opacity * ghostOpacity;

    context.translate( gx, gy );

    drawLine( effectiveGhostOpacity );
    drawArrows( effectiveGhostOpacity );

    context.translate( -gx, -gy );
  }

  drawLine();
  drawArrows();
  drawOverlay();
  drawText();

  if( shiftToOriginWithBb ){
    context.translate( bb.x1, bb.y1 );
  }
};


CRp.drawEdgePath = function( edge, context, pts, type ){
  let rs = edge._private.rscratch;
  let canvasCxt = context;
  let path;
  let pathCacheHit = false;
  let usePaths = this.usePaths();

  if( usePaths ){
    let pathCacheKey = pts.join( '$' );
    let keyMatches = rs.pathCacheKey && rs.pathCacheKey === pathCacheKey;

    if( keyMatches ){
      path = context = rs.pathCache;
      pathCacheHit = true;
    } else {
      path = context = new Path2D();
      rs.pathCacheKey = pathCacheKey;
      rs.pathCache = path;
    }
  }

  if( canvasCxt.setLineDash ){ // for very outofdate browsers
    switch( type ){
      case 'dotted':
        canvasCxt.setLineDash( [ 1, 1 ] );
        break;

      case 'dashed':
        canvasCxt.setLineDash( [ 6, 3 ] );
        break;

      case 'solid':
        canvasCxt.setLineDash( [ ] );
        break;
    }
  }

  if( !pathCacheHit && !rs.badLine ){
    if( context.beginPath ){ context.beginPath(); }
    context.moveTo( pts[0], pts[1] );

    switch( rs.edgeType ){
      case 'bezier':
      case 'self':
      case 'compound':
      case 'multibezier':
        for( let i = 2; i + 3 < pts.length; i += 4 ){
          context.quadraticCurveTo( pts[ i ], pts[ i + 1], pts[ i + 2], pts[ i + 3] );
        }
        break;

      case 'straight':
      case 'segments':
      case 'haystack':
        for( let i = 2; i + 1 < pts.length; i += 2 ){
          context.lineTo( pts[ i ], pts[ i + 1] );
        }
        break;
    }
  }

  context = canvasCxt;
  if( usePaths ){
    context.stroke( path );
  } else {
    context.stroke();
  }

  // reset any line dashes
  if( context.setLineDash ){ // for very outofdate browsers
    context.setLineDash( [ ] );
  }

};

CRp.drawArrowheads = function( context, edge, opacity ){
  let rs = edge._private.rscratch;
  let isHaystack = rs.edgeType === 'haystack';

  if( !isHaystack ){
    this.drawArrowhead( context, edge, 'source', rs.arrowStartX, rs.arrowStartY, rs.srcArrowAngle, opacity );
  }

  this.drawArrowhead( context, edge, 'mid-target', rs.midX, rs.midY, rs.midtgtArrowAngle, opacity );

  this.drawArrowhead( context, edge, 'mid-source', rs.midX, rs.midY, rs.midsrcArrowAngle, opacity );

  if( !isHaystack ){
    this.drawArrowhead( context, edge, 'target', rs.arrowEndX, rs.arrowEndY, rs.tgtArrowAngle, opacity );
  }
};

CRp.drawArrowhead = function( context, edge, prefix, x, y, angle, opacity ){
  if( isNaN( x ) || x == null || isNaN( y ) || y == null || isNaN( angle ) || angle == null ){ return; }

  let self = this;
  let arrowShape = edge.pstyle( prefix + '-arrow-shape' ).value;
  if( arrowShape === 'none' ) { return; }

  let arrowClearFill = edge.pstyle( prefix + '-arrow-fill' ).value === 'hollow' ? 'both' : 'filled';
  let arrowFill = edge.pstyle( prefix + '-arrow-fill' ).value;
  let edgeWidth = edge.pstyle( 'width' ).pfValue;
  let edgeOpacity = edge.pstyle( 'opacity' ).value;

  if( opacity === undefined ){
    opacity = edgeOpacity;
  }

  let gco = context.globalCompositeOperation;

  if( opacity !== 1 || arrowFill === 'hollow' ){ // then extra clear is needed
    context.globalCompositeOperation = 'destination-out';

    self.fillStyle( context, false, 255, 255, 255, 1 );
    self.strokeStyle( context, false, 255, 255, 255, 1 );

    self.drawArrowShape( edge, context,
      arrowClearFill, edgeWidth, arrowShape, x, y, angle
    );

    context.globalCompositeOperation = gco;
  } // otherwise, the opaque arrow clears it for free :)

  let color = edge.pstyle( prefix + '-arrow-color' ).value;
  self.fillStyle( context, false, color[0], color[1], color[2], opacity );
  self.strokeStyle( context, false, color[0], color[1], color[2], opacity );

  self.drawArrowShape( edge, context,
    arrowFill, edgeWidth, arrowShape, x, y, angle
  );
};

CRp.drawArrowShape = function( edge, context, fill, edgeWidth, shape, x, y, angle ){
  let r = this;
  let usePaths = this.usePaths();
  let pathCacheHit = false;
  let path;
  let canvasContext = context;
  let translation = { x, y };
  let scale = edge.pstyle( 'arrow-scale' ).value;
  let size = this.getArrowWidth( edgeWidth, scale );
  let shapeImpl = r.arrowShapes[ shape ];

  if( usePaths ){
    let cache = r.arrowPathCache = r.arrowPathCache || [];
    let key = util.hashString(shape);
    let cachedPath = cache[ key ];

    if( cachedPath != null ){
      path = context = cachedPath;
      pathCacheHit = true;
    } else {
      path = context = new Path2D();
      cache[ key ] = path;
    }
  }

  if( context.beginPath ){ context.beginPath(); }

  if( !pathCacheHit ){
    if( usePaths ){ // store in the path cache with values easily manipulated later
      shapeImpl.draw( context, 1, 0, { x: 0, y: 0 }, 1 );
    } else {
      shapeImpl.draw( context, size, angle, translation, edgeWidth );
    }
  }

  if( context.closePath ){ context.closePath(); }

  context = canvasContext;

  if( usePaths ){ // set transform to arrow position/orientation
    context.translate( x, y );
    context.rotate( angle );
    context.scale( size, size );
  }

  if( fill === 'filled' || fill === 'both' ){
    if( usePaths ){
      context.fill( path );
    } else {
      context.fill();
    }
  }

  if( fill === 'hollow' || fill === 'both' ){
    context.lineWidth = ( shapeImpl.matchEdgeWidth ? edgeWidth : 1 ) / ( usePaths ? size : 1 );
    context.lineJoin = 'miter';

    if( usePaths ){
      context.stroke( path );
    } else {
      context.stroke();
    }
  }

  if( usePaths ){ // reset transform by applying inverse
    context.scale( 1/size, 1/size );
    context.rotate( -angle );
    context.translate( -x, -y );
  }
};

module.exports = CRp;
