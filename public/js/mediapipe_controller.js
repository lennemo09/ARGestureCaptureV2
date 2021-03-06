const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const dataElement = document.getElementById('dataOverlay');
const canvasCtx = canvasElement.getContext('2d');
const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 500;
const states = {
    IDLE: 'idle',
    RECORDING: 'recording'
}
let currentState = states.IDLE;
let initTimer = new Date();
let sampleData = "";
let predictionStack = [];
let handJoints = [];
let intervalID = null;
const months = ["JAN", "FEB", "MAR","APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const recordingStartDelay = 3;
let buidInProcess = false;

let drawSkeleton = true;

var worker = new Worker('../../js/worker.js');
async function toggleRecording() {
  let recordButton = $("#recordButton");
  if (recordButton != null) {
    if (recordButton.hasClass("recordButton-inactive")) {

      // Start timer here:
      recordButton.css("display",'none');
      await startTimer(recordingStartDelay);

      recordButton.css("display",'');
      recordButton.removeClass("recordButton-inactive");
      recordButton.addClass("recordButton-active");
      recordButton.text("Stop");
      
      // When timer finishes:
      startLog();
      currentState = states.RECORDING;
      
      console.log("Starting Recording!");
    } else if (recordButton.hasClass("recordButton-active")){
      recordButton.removeClass("recordButton-active");
      recordButton.addClass("recordButton-inactive");
      recordButton.text("Record");

      buildLog($("#dataOverlay").attr('class'));
      currentState = states.IDLE;
      console.log("Stopped Recording!");
    }
  }
}

window.toggleRecording = toggleRecording;


// Format recording data into Json type. 
function buildLog(actionName) {
  if (!buidInProcess) {
      buidInProcess = true;
      let data = {
          operation: actionName,
          recordingnumber: getRecordingCount(),
          bodydata: {
              RHand: [],
              LHand: []
          }
      };
      for (let i = 0; i < predictionStack.length; i++) {
          if (predictionStack[i][1].length == 2 && predictionStack[i][2].length == 2) {
              // Swapped hand indices due to mirrored canvas projection.
              const lindex = (predictionStack[i][1][0].label == "Left") ? 1 : 0;
              const rindex = (predictionStack[i][1][0].label == "Right") ? 1 : 0;

              const LHandData = {time: predictionStack[i][0],keypoints: predictionStack[i][2][lindex]};
              const RHandData = {time: predictionStack[i][0],keypoints: predictionStack[i][2][rindex]};
              data.bodydata.LHand.push(LHandData);
              data.bodydata.RHand.push(RHandData);
              handJoints.push({time: predictionStack[i][0], Lkeypoints: predictionStack[i][2][lindex], Rkeypoints: predictionStack[i][2][rindex]});
          } else if (predictionStack[i][1].length == 1 && predictionStack[i][2].length == 1) {
              if (predictionStack[i][1][0].label == "Left") {
                  // Swapped hand indices due to mirrored canvas projection.
                  const RHandData = {time: predictionStack[i][0],keypoints: predictionStack[i][2][0]};
                  const LHandData = {time: predictionStack[i][0],keypoints: [NaN]};
                  data.bodydata.RHand.push(RHandData);                  
                  data.bodydata.LHand.push(LHandData);
                  handJoints.push({time: predictionStack[i][0], Lkeypoints: [], Rkeypoints: predictionStack[i][2][0]});
              } else if (predictionStack[i][1][0].label == "Right") {
                  // Swapped hand indices due to mirrored canvas projection.
                  const RHandData = {time: predictionStack[i][0],keypoints: [NaN]};
                  const LHandData = {time: predictionStack[i][0],keypoints: predictionStack[i][2][0]};
                  data.bodydata.RHand.push(RHandData);
                  data.bodydata.LHand.push(LHandData);
                  handJoints.push({time: predictionStack[i][0], Lkeypoints: predictionStack[i][2][0], Rkeypoints: []});
              }
          }
      }
      stopLog(data);
      predictionStack = [];
      buidInProcess = false;
  }
}

// Start recording gesture cordinates.
function startLog() {
  // Init time elapsed counter and data logging.
  initTimer = new Date();
}

// Stop recording gesture cordinates.
async function stopLog(parsedData) {

  // if (parsedData.handdata.LHand.length <= 0 && parsedData.handdata.RHand.length <= 0) {
  //     $('#responseStatus').css('display', 'inline-block');
  //     $('#responseStatus').css('color', 'salmon');
  //     $('#responseStatus').text('There are no data in recorded clip to save!');
  //     $('#responseStatus').fadeOut(6600);
  //     return;
  // }

  // If client-side parse enabled, run background thread to parse json data to csv.
  // To increase performance of the app.
  // Send data to server.

  var cachedUserId;
  if (localStorage.getItem('userId') != null) {
    cachedUserId = localStorage.getItem('userId');
  } else {
    cachedUserId = localStorage.getItem('userIdAnon');
  }

  if (parsedData.bodydata.LHand.length <= 0 && parsedData.bodydata.RHand.length <= 0) {
    console.log('There are no data in recorded clip to save!');
    emptyRecording();
    return;
  }

  const directoryName = `${parsedData.operation}/` + cachedUserId;
  $("#recordButton").text("Saving...");
  try {
    await sendHandsGestureToServer(directoryName,parsedData);
  } catch {
    $("#recordButton").text("Record");
  }
}

async function sendHandsGestureToServer(directoryPath,parsedData) {
  $.post("/results/hands/", {dirName: directoryPath, data: parsedData}, function (data, status, jqXHR) {
    if (status == 'success') {
      //console.log(parsedData);
      console.log("Data sent to server successfully!");
      finishRecording(true,handJoints);
      handJoints = [];
      $("#recordButton").text("Record");
      // addNewRecording();
      // createBodyJointsGeometry(bodyJoints);
    } else {
      console.log("Data sent to server failed.");
      failedRecording();
      $("#recordButton").text("Record");
    }
  });
}

// Save data on client side.
worker.onmessage = function (e) {
  e.data.forEach(csvData => {
      download(csvData[0], csvData[1]);
  });
}

// Auto download data on client-side after recording.
function download(filename, data) {
  var element = document.createElement('a');
  element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(data));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

// To get current datetime string format.
function getFormattedDateTime(dt = Date){
  return dt.getDate() + "-" + 
      months[dt.getMonth()] + "-" + 
      dt.getFullYear() + " " + 
      dt.getHours() + "-" + 
      dt.getMinutes() + "-" + 
      dt.getSeconds();
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function toggleDrawSkeleton(checkbox) {
  if(checkbox.checked){
    drawSkeleton = true;
    console.log("Enabled hands skeleton");
  } else {
    drawSkeleton = false;
    console.log("Disabled hands skeleton");
  }
}

function toggleDrawData(checkbox) {
  if(checkbox.checked){
    dataElement.style.display = "block";
    console.log("Enabled reference animation");
  } else {
    dataElement.style.display = "none";
    console.log("Disabled reference animation");
  }
}
window.toggleDrawSkeleton = toggleDrawSkeleton;
window.toggleDrawData = toggleDrawData;

// Callback of API, called when hand is detected.
function onResults(results) {
    // console.log(results);
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    if (results.multiHandLandmarks) {
        // Saving recording results
        if (currentState == states.RECORDING) {
            const elapsedTime = (new Date() - initTimer);
            predictionStack.push([elapsedTime, results.multiHandedness, results.multiHandLandmarks]);
        }
        // drawing points on hand
        if (drawSkeleton) {
          //console.dir(results.multiHandLandmarks);
          for (const landmarks of results.multiHandLandmarks) {
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS,
                            {color: '#FFFF00', lineWidth: 3});
            drawLandmarks(canvasCtx, landmarks, {color: '#FF0000', lineWidth: 1});
          }
        }        
    }
    canvasCtx.restore();
}

const hands = new Hands({locateFile: (file) => {
  return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

hands.onResults(onResults);

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({image: videoElement});
  },
  width: VIDEO_WIDTH,
  height: VIDEO_HEIGHT
});
camera.start();
