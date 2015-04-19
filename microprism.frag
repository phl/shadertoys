const float minCells = 1.;
const float maxCells = 50.;
const float defaultCells = 12.;
const float aberration = 1.05;

float screenAspect = iResolution.x/iResolution.y;
float triAspect = 0.866; //sqrt(3.)/ 2.;

float hitTest(vec2 uv, vec2 cellSize) {

    vec2 cellOffset = mod(uv,cellSize) / cellSize;
    vec2 cellIdx = floor(uv/cellSize);
    vec2 subCellIdx = vec2(cellIdx.x*2. + step(.5,cellOffset.x), cellIdx.y);

    float oddRow = sign(mod(subCellIdx.y,2.));
    float oddSubCol = sign(mod(subCellIdx.x,2.));
    
	float testTopLeft = 1.-mod(oddRow + oddSubCol,2.);
    
    float tlScore = (mod(cellOffset.x,.5)*2.)-(1.-cellOffset.y);
    float trScore = cellOffset.y-(mod(cellOffset.x,.5)*2.);
    float tbScore = (fract(cellOffset.y+.5)-.5)*2.;
    
    float oddEven = sign(mix(tlScore,trScore,testTopLeft));
    
    // +/- for odd/even triangles, magnitude is distance from nearest edge
    return oddEven * min(abs(mix(tlScore,trScore,testTopLeft)),abs(tbScore));
}

float distFromTriCentre(vec2 uv, vec2 cellSize, float hitScore) {

    vec2 cellIdx = floor(uv/cellSize);
    float oddRow = sign(mod(cellIdx.y,2.));
    float oddTri = 1.-mod(oddRow + hitScore,2.);

    vec2 cellOffset = mod(uv,cellSize)/cellSize;
    cellOffset.x = fract(cellOffset.x +.5 * sign(1.-oddTri));
        
    vec2 triOffset = vec2((cellOffset.x-.5)/triAspect, 
               mix(cellOffset.y-(1./3.),
                   cellOffset.y-(1.-(1./3.)),
                   hitScore));

    return length(triOffset)*3./2.;
}

vec2 fixUV(vec2 uv) {

    // flip y unless video
    return vec2(uv.x,mix(1.-uv.y,uv.y,sign(iChannelTime[0])));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    
    // set offset via mouse-x if button down, else timer
    vec2 offset = mix(vec2(.4*sin(iGlobalTime/1.5),.0),
                      vec2(.5-(iMouse.x / iResolution.x),.0),
                      step(1.,iMouse.z));
    offset *= mat2(.9659,-.2588,.2588,.9659); // 15deg rotation
    
    // set mosaic density via mouse-y if button down, else default
    float cellsHigh = mix(defaultCells,
                      mix(minCells,maxCells,1.-sqrt(1.-(iMouse.y / iResolution.y))),
                      step(1.,iMouse.z));
    
    float cellsWide = cellsHigh * screenAspect * triAspect;
    vec2 cellSize = vec2(1./cellsWide,1./cellsHigh);
    
    vec2 uv = fixUV(fragCoord.xy / iResolution.xy);
    
    // find whether co-ord in 'odd' or 'even' cell
    float score = hitTest(uv-.5,cellSize);
    float oddEven = step(.0,score);
    
    // texture lookup with chroma spread
    vec2 uvTranslate = .5 * cellSize * mix(-offset/4.,offset,oddEven);
    float chromAbr = pow(aberration,sqrt(1.2*cellsHigh));
    vec4 txColor = vec4(  	
    	texture2D(iChannel0, clamp(uv+(uvTranslate/chromAbr),0.,1.)).x,
		texture2D(iChannel0, clamp(uv+uvTranslate,0.,1.)).y,
    	texture2D(iChannel0, clamp(uv+(chromAbr*uvTranslate),0.,1.)).z,
        1.);
  
    // vary brightness based on offset, with gradient from top of cell
    float bright = (.04 + (.04 * length(offset)/.5)) * (1.-(.7*fract((uv.y-.5)/cellSize.y)));
    fragColor = mix(txColor, mix(pow(txColor,vec4(2.)), vec4(1.)-pow(vec4(1.)-txColor,vec4(2.)),oddEven), vec4(bright));
    
    // vignetting based on distance from centre of cell, attenuated by cell count
    float attn = pow(.97,pow(cellsHigh,1.3));
    float vignette = distFromTriCentre(uv-.5, cellSize, oddEven);
    fragColor -= .25*attn * (1. - (pow(.92,3.*pow(vignette,2.5))));
    
    // darken near tri edges
    float edges = 1.-pow(abs(score),.5);
    fragColor -= .5*attn * (1. - (pow(.9,1.*pow(edges,4.))));
}
