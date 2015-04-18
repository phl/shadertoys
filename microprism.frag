const float minCells = 1.;
const float maxCells = 50.;
const float defaultCells = 14.;
const float aberration = 1.05;

float screenAspect = iResolution.x/iResolution.y;
float triAspect = 0.866; //sqrt(3.)/ 2.;

float hitTest(vec2 uv, vec2 cellSize) {

    vec2 cellOffset = mod(uv,cellSize);
    vec2 cellIdx = floor(uv/cellSize);
    vec2 subCellIdx = vec2(cellIdx.x*2.0 + step(.5,cellOffset.x/cellSize.x), cellIdx.y);

    float oddRow = sign(mod(subCellIdx.y,2.0));
    float oddSubCol = sign(mod(subCellIdx.x,2.0));
    
	float testTopLeft = 1.0-mod(oddRow + oddSubCol,2.0);
    
    // 0.0 or 1.0
    return mix(
        step((cellSize.y-cellOffset.y)/(screenAspect*triAspect),mod(cellOffset.x,cellSize.x/2.0)*2.0),
        step(mod(cellOffset.x,cellSize.x/2.0)*2.0,cellOffset.y/(screenAspect*triAspect)),        
        testTopLeft
        );
}

float distFromTriCentre(vec2 uv, vec2 cellSize, float hitScore) {

    vec2 cellIdx = floor(uv/cellSize);
    float oddRow = sign(mod(cellIdx.y,2.0));
    float oddTri = 1.0-mod(oddRow + hitScore,2.0);

    vec2 cellOffset = mod(vec2(uv.x+mix(cellSize.x*.5,.0,oddTri),uv.y),cellSize);
    vec2 triOffset = vec2(cellOffset.x-(cellSize.x*.5), 
               mix(cellOffset.y-(.5*cellSize.x),
                   cellOffset.y-(cellSize.y-(.5*cellSize.x)),
                   hitScore)/screenAspect);

    return triAspect*length(triOffset)/(.5*cellSize.x);
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
    vec2 cellSize = vec2(1.0/cellsWide,1.0/cellsHigh);
    
	vec2 uv = fixUV(fragCoord.xy / iResolution.xy);
    
    // find whether co-ord in 'odd' or 'even' cell
    float hitScore = hitTest(uv-.5, cellSize);      
    
    // texture lookup with chroma spread
    vec2 uvTranslate = .5 * cellSize * mix(-offset/4.,offset*1.2,hitScore);
    float chromAbr = pow(aberration,sqrt(1.2*cellsHigh));
    
    float dist = distFromTriCentre(uv-.5, cellSize,hitScore);
    
    vec4 txColor = vec4(1.);
    txColor.x = texture2D(iChannel0, uv+(uvTranslate/chromAbr)).x;
    txColor.y = texture2D(iChannel0, uv+uvTranslate).y;
    txColor.z = texture2D(iChannel0, uv+(chromAbr*uvTranslate)).z;
  
    // vary brightness based on offset, distance from top of cell
    float bright = (.04 + (.04 * length(offset)/.5)) * (1.-(.7*fract((uv.y-.5)/cellSize.y)));
    fragColor = mix(txColor, mix(pow(txColor,vec4(2.)), vec4(1.)-pow(vec4(1.)-txColor,vec4(2.)),hitScore), vec4(bright));
	fragColor -= pow(.94,pow(cellsHigh,1.3)) * .8 * (1. - (pow(.92,3.*pow(dist,2.5))));
}
