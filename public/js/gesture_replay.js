'use strict'

var replayContainer = document.getElementById( 'replayOverlay' );
var visualisationName = $(replayContainer).attr('class');

var replayScene = new THREE.Scene();
var replayRenderer = new THREE.WebGLRenderer( { antialias: true, alpha: true, transparent: true });
replayRenderer.autoClear = true;
replayRenderer.setPixelRatio(window.devicePixelRatio);
replayRenderer.setSize($(replayContainer).width(), $(replayContainer).height());
replayContainer.appendChild( replayRenderer.domElement );
replayContainer.style.pointerEvents = "none";

const replayCamera = new THREE.OrthographicCamera(0, $(container).width(), 0, -$(container).height(), 1, 1000 );
replayCamera.position.z = 10;
replayScene.add( replayCamera );

var replayResolution = new THREE.Vector2( $(container).width(), $(container).height() );

var jointsGroup = new THREE.Group();
var currentData = [];

let replayClock = new THREE.Clock();
let replayDelta = 0;
// 30 fps
let replayInterval = 1 / 30;

var startTime;
var currentTime;
var elapsedTime;
var timeOffset;
var currentDataIndex = 0;

const pointMat = new THREE.MeshBasicMaterial( {color: 0xff0000} );

const lineMat = new MeshLineMaterial( {
    useMap: false,
    color: new THREE.Color( 0xffff00 ),
    opacity: 1,
    resolution: replayResolution,
    sizeAttenuation: false,
    lineWidth: 8,
});

const handJointPairs = [
    [0,1], [1,2], [2,3], [3,4],
    [0,5], [5,6], [6,7], [7,8],
    [5,9], [9,10], [10,11], [11,12],
    [9,13], [13,14], [14,15], [15,16],
    [13,17], [17,18], [18,19], [19,20],
    [0,17]
]

function clearGroup(group) {
    for (var i = group.children.length - 1; i >= 0; i--) {
        group.remove(group.children[i]);
    }
}

function screenSpaceToWorld(x,y) {
    const newX = x * $(replayContainer).width();
    const newY = y * -$(replayContainer).height();
    return {x: newX, y: newY};
}

function drawLine(points) {
    const line = new MeshLine();
    line.setPoints(points);
    
    const lineMesh = new THREE.Mesh(line, lineMat);

    jointsGroup.add( lineMesh )
}

function plotPoint(x=0, y=0, z=0, radius = 1.0) {
    const geometry = new THREE.SphereGeometry( radius, 32, 32 );
    const sphere = new THREE.Mesh( geometry, pointMat );
    sphere.position.x = x;
    sphere.position.y = y;
    sphere.position.z = z;
    jointsGroup.add( sphere );
}

function drawHand(handJoints) {
    if (handJoints.length === 0 || handJoints.Lkeypoints.length === 0 && handJoints.Rkeypoints.length === 0) return;
    var LHand = handJoints.Lkeypoints;
    var RHand = handJoints.Rkeypoints;

    for (let i = 0; i < 21; i++) {
        //console.log("a joint");
        var LJoint = LHand[i];
        var RJoint = RHand[i];

        if (LJoint) {
            var LWorldPos = screenSpaceToWorld(LJoint.x, LJoint.y);
            plotPoint(LWorldPos.x,LWorldPos.y,0,7);
        }

        if (RJoint) {
            var RWorldPos = screenSpaceToWorld(RJoint.x, RJoint.y);
            plotPoint(RWorldPos.x,RWorldPos.y,0,7);
        }
        //console.dir(joint);
        
    }

    for (let i = 0; i < handJointPairs.length; i++) {
        var pair = handJointPairs[i]

        if (LHand.length > 0) {
            var LStartPoint = LHand[pair[0]];
            var LEndPoint = LHand[pair[1]];

            var LLineStart = screenSpaceToWorld(LStartPoint.x, LStartPoint.y);
            var LLineEnd = screenSpaceToWorld(LEndPoint.x, LEndPoint.y);

            drawLine([LLineStart.x,LLineStart.y,0,LLineEnd.x,LLineEnd.y,0]);
        }
        if (RHand.length > 0) {
            var RStartPoint = RHand[pair[0]];
            var REndPoint = RHand[pair[1]];

            var RLineStart = screenSpaceToWorld(RStartPoint.x, RStartPoint.y);
            var RLineEnd = screenSpaceToWorld(REndPoint.x, REndPoint.y);

            drawLine([RLineStart.x,RLineStart.y,0,RLineEnd.x,RLineEnd.y,0]);
        }
    }
}
// if (currentDataIndex === 0) {
//     drawJoints(handJoints[0]);
//     currentDataIndex++;
// } else {
//     currentTime = date.getTime();		
//     elapsedTime = (currentTime - startTime) + timeOffset;
    
//     if (elapsedTime > handJoints[currentDataIndex].time) {
//         clearCanvas();
//         drawJoints(handJoints[0]);
//         currentDataIndex++;
//     }
// }	

function animateHandsReplay() {
    requestAnimationFrame( animateHandsReplay );
    replayDelta += replayClock.getDelta();

    if (replayDelta  > replayInterval) {
        if (currentDataIndex === 0) {
            drawHand(currentData[0]);
            currentDataIndex++;
        } else if (currentDataIndex >= currentData.length) {
            //clearReplayCanvas();
            return;
        } else {
            clearGroup(jointsGroup);
            currentTime = replayClock.getElapsedTime() * 1000;
            var currentHands = currentData[currentDataIndex];
            
            elapsedTime = (currentTime - startTime) + timeOffset;
            // console.log(`Current time: ${currentTime}, Start time: ${startTime}, Time offset ${timeOffset}`)
            // console.log(`Index: ${currentDataIndex}, Elapsed time: ${elapsedTime}, Current hands time ${currentHands.time}`)
            // console.dir(currentHands);
    
            if (elapsedTime > currentHands.time) {
                //clearReplayCanvas();
                drawHand(currentHands);
                currentDataIndex++;
            }
        }
        replayDelta = replayDelta % replayInterval;
    }
    replayRenderer.render(replayScene, replayCamera);
}
function createHandJointsGeometry(handJoints) {
    //clearReplayCanvas();
    if (handJoints.length === 0) return;

    startTime = replayClock.getElapsedTime() * 1000;
    currentTime = startTime;
    currentData = handJoints;
    timeOffset = handJoints[0].time;    

    replayScene.add(jointsGroup);
    animateHandsReplay();
}

function clearReplayCanvas() {
    clearGroup(replayScene);
}

window.createHandJointsGeometry = createHandJointsGeometry;
window.clearReplayCanvas = clearReplayCanvas;