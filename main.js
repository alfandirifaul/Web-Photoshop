document.addEventListener('DOMContentLoaded', (event) => {
    function handleImageInput(event){
        const fileInput = event.target;
        const file = fileInput.files[0];
        if(file){
            const reader = new FileReader();
            reader.onload = function(e){
                const imgMain = document.getElementById("img-main");
                imgMain.src = e.target.result;
                imgMain.onload = function() {
                    // Automatically display the image on the canvas once it is loaded
                    let imgMainCv = cv.imread(imgMain);
                    cv.imshow('main-canvas', imgMainCv);
                    imgMainCv.delete(); // Clean up after showing the image
                };
            };
            reader.readAsDataURL(file);
        }
    }

    function getLabelColor(className){
        let color;
        if(className === 'person'){
            color = [255, 155, 100, 255];
        }
        else{
            color = [0, 255, 0, 200];
        }
        return color;
    }

    function drawBoundingBox(predictions, image){
        predictions.forEach(
            prediction => {
                const bbox = prediction.bbox;
                const x  = bbox[0];
                const y = bbox[1];
                const width = bbox[2];
                const height = bbox[3];
                const className = prediction.class;
                const confScore = prediction.score;
                const color = getLabelColor(className);
                console.log(x, y, width, height, className, confScore);
                let point1 = new cv.Point(x, y);
                let point2 = new cv.Point((x + width), (y + height));
                cv.rectangle(image, point1, point2, color, 2);
                const text = `${className} - ${Math.round(confScore*100)/100}`;
                const font = cv.FONT_HERSHEY_TRIPLEX;
                const fontSize = 0.7;
                const thickness = 1;

                // Get size of the text
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                const textMetrics = context.measureText(text);
                const twidth = textMetrics.width;
                console.log('Text Width', twidth);
                cv.rectangle(image, new cv.Point(x, (y - 20)), new cv.Point((x + twidth + 125),  y), color, -1);
                cv.putText(image, text, new cv.Point(x, y - 5), font, fontSize, new cv.Scalar(255, 255, 255, 255), thickness);
            }
        )
    }

    function openCVReady(){
        cv['onRuntimeInitialized'] = () => {
            console.log("OpenCV Ready");

            let imgMain = cv.imread("img-main");
            cv.imshow("main-canvas", imgMain);
            imgMain.delete();

            // Image Input
            document.getElementById('file-upload').addEventListener('change', handleImageInput);

            // Object Detection Image
            document.getElementById('img-detection').onclick = () => {
                console.log('Object Detection Image');
                const image = document.getElementById('img-main');

                // load the model
                console.log('Loading Model');
                cocoSsd.load().then(model => {
                    console.log('Model Loaded');
                    model.detect(image).then(predictions => {
                        console.log('Predictions', predictions);
                        console.log('Length of Predictions', predictions.length);
                        const imageElement = cv.imread(image);
                        let inputImage = imageElement;
                        // check the any predictions
                        if(predictions.length > 0){
                            drawBoundingBox(predictions, inputImage);
                            cv.imshow('main-canvas', inputImage);  
                            inputImage.delete();
                        }
                        else{
                            cv.imshow('main-canvas', inputImage);
                            inputImage.delete();
                        }
                    });
                });
            }

            document.getElementById('enable-btn').onclick = function(){
                const video = document.getElementById('video-main');
                const canvas = document.getElementById('main-canvas');
                const context = canvas.getContext('2d', { willReadFrequently: true });
                let streaming = false;  // Global flag to track if streaming
                let videoStream = null; // Store the video stream

                // Enable Camera Function
                function enableCam() {
                    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
                        .then(function (stream) {
                            video.srcObject = stream;
                            videoStream = stream;
                            video.play();
                            streaming = true;  // Set the streaming flag to true
                            drawVideoOnCanvas(); // Start drawing the video frame on the canvas
                        })
                        .catch(function (err) {
                            console.log("Error accessing camera: " + err);
                        });
                }

                // Stop Camera Function
                function stopCam() {
                    if (videoStream) {
                        let tracks = videoStream.getTracks();
                        tracks.forEach(function (track) {
                            track.stop();
                        });
                        video.srcObject = null;
                        streaming = false;  // Set the streaming flag to false
                    }
                }

                // Toggle Video Streaming
                document.getElementById('enable-btn').onclick = function () {
                    if (streaming) {
                        console.log("Pausing video");
                        stopCam();  // Stop video stream
                    } else {
                        console.log("Starting video");
                        enableCam();  // Start video stream
                    }
                };

                // Draw video frame on the canvas
                function drawVideoOnCanvas() {
                    if (streaming) {
                        if (video.readyState === video.HAVE_ENOUGH_DATA) {
                            context.drawImage(video, 0, 0, canvas.width, canvas.height);
                        }
                        // Schedule the next frame
                        requestAnimationFrame(drawVideoOnCanvas);
                    }
                }
            };
            
            // Detect Objects when Detect button is pressed
            document.getElementById('video-detection').onclick = () => {
                console.log('Starting Object Detection');
                const video = document.getElementById('video-main');
                const canvas = document.getElementById('main-canvas');
                const context = canvas.getContext('2d', { willReadFrequently: true });
                let model = undefined;
                const FPS = 24;
            
                // Load the COCO-SSD model
                function loadModel() {
                    console.log('Loading Model');
                    cocoSsd.load().then(function(loadedModel) {
                        model = loadedModel;
                        console.log("Model Loaded");
                        predictWebCam(); // Start detection
                    }).catch(function(error) {
                        console.log("Error loading model: " + error);
                    });
                }
            
                // Perform object detection on the live webcam feed
                function predictWebCam() {
                    if (video.videoWidth > 0 && video.videoHeight > 0) {
                        // Draw the video on the canvas
                        context.drawImage(video, 0, 0, canvas.width, canvas.height);
            
                        // Perform object detection using the loaded model
                        model.detect(video).then(predictions => {
                            console.log("Predictions", predictions);
                            let imgMainCv = cv.imread(canvas);
            
                            if (predictions.length > 0) {
                                drawBoundingBox(predictions, imgMainCv);
                            }
            
                            // Display the result
                            cv.imshow('main-canvas', imgMainCv);
                            imgMainCv.delete();
            
                            const delay = 1000 / FPS;
                            setTimeout(predictWebCam, delay);
                        }).catch(function(error) {
                            console.log("Error in object detection: " + error);
                        });
                    } else {
                        // If the video isn't ready, try again on the next frame
                        requestAnimationFrame(predictWebCam);
                    }
                }

                function predictWebCam() {
                    const context = canvas.getContext('2d');
                
                    // Ensure video is ready
                    if (video.videoWidth > 0 && video.videoHeight > 0) {
                        // Draw the video frame on the canvas
                        context.drawImage(video, 0, 0, canvas.width, canvas.height);
                        
                        // Perform object detection on the current video frame
                        model.detect(video).then(predictions => {
                            console.log("Predictions", predictions);
                            let imgMainCv = cv.imread(canvas);
                
                            if (predictions.length > 0) {
                                drawBoundingBox(predictions, imgMainCv);
                            }
                
                            // Display the result on the canvas
                            cv.imshow('main-canvas', imgMainCv);
                            imgMainCv.delete();
                
                            // Continue processing the next frame
                            requestAnimationFrame(predictWebCam);
                        }).catch(function(error) {
                            console.log("Error in object detection: " + error);
                            requestAnimationFrame(predictWebCam);
                        });
                    } else {
                        // If video isn't ready, try again on the next frame
                        requestAnimationFrame(predictWebCam);
                    }
                }
            
                // Load model if not already loaded
                if (!model) {
                    loadModel(); // Load model and start detection
                } else {
                    console.log("Model already loaded, starting detection");
                    predictWebCam(); // Start detection directly if model is already loaded
                }
            };
        }
    }

    if (typeof cv !== 'undefined') {
        openCVReady();
    } else {
        document.addEventListener('opencvReady', openCVReady);
    }
});