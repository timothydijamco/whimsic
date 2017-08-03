var express = require('express');
var app = express();
var request = require('request');

var GeoUtils = require('./utils/GeoUtils');
var MathUtils = require('./utils/MathUtils');

var port = process.env.PORT || 8080;
var router = express.Router();
app.use("/api", router);

// Endpoint: /api/random
router.route('/random').get(function(req, res) {
   var from = req.query.from;
   var to = req.query.to;

   request(
      "https://maps.googleapis.com/maps/api/directions/json?origin=" + from + "&destination=" + to + "&key=" + process.env.GOOGLE_MAPS_API_KEY,
      function(error, response, body) {
         var json = JSON.parse(body);

         // Get relevant information from JSON
         var totalDistance = json.routes[0].legs[0].distance.value;
         var endLocation = json.routes[0].legs[0].end_location;
         var steps = json.routes[0].legs[0].steps;

         // Sort steps by distance travelled during step, descending
         steps.sort(function compare(a, b) {
            return (b.distance.value - a.distance.value); // Longer distance will come first in array
         });

         // Get latitude and longitude of the start location of the longest step
         var longestStepLocation = steps[0].start_location;

         // Get a location to replace the start location of the longest step.
         // However, the new location must not be farther away from the destination
         // than the step's location is.
         var longestStepDistance = GeoUtils.calculateDistance(longestStepLocation.lat, longestStepLocation.lng, endLocation.lat, endLocation.lng); // Current distance from this step location to end location
         var newDistance = Number.MAX_VALUE;
         var newLocation = {
            lat: 0,
            lng: 0
         }
         var minDiffMagnitude = (totalDistance * 0.06) / 90000; // Roughly 90,000 meters per longitude or latitude degree
         var maxDiffMagnitude = (totalDistance * 0.12) / 90000;
         while (newDistance > longestStepDistance) { // While the new location is farther than the current location for the step
            // Generate a random change in latitude and a random change in longitude,
            // but the magnitude of the change change must be between minDiffMagnitude
            // and maxDiffMagnitude
            var latChange = 0;
            var lngChange = 0;
            while (Math.abs(latChange) < minDiffMagnitude || Math.abs(lngChange) < minDiffMagnitude) {
               latChange = MathUtils.getRandom(-maxDiffMagnitude, maxDiffMagnitude);
               lngChange = MathUtils.getRandom(-maxDiffMagnitude, maxDiffMagnitude);
            }

            // Generate a new location
            newLocation.lat = longestStepLocation.lat + latChange;
            newLocation.lng = longestStepLocation.lng + lngChange;

            newDistance = GeoUtils.calculateDistance(newLocation.lat, newLocation.lng, endLocation.lat, endLocation.lng);
         }
         
         console.log("Distance of new location from longest step location: " + GeoUtils.calculateDistance(newLocation.lat, newLocation.lng, longestStepLocation.lat, longestStepLocation.lng));

         // Return a route on Google Maps that includes the new location as a waypoint
         // in between the the "from" location and the "to" location specified in
         // the GET parameters to the request to this /random endpoint.
         res.json({ url: "https://www.google.com/maps?saddr=" + from + "&daddr=" + newLocation.lat + "," + newLocation.lng + "+to:" + to });

      }
   )

});

app.listen(port);
console.log("Server started. Listening on port " + port + ".");
