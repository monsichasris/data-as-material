const STATION_STOP_ID = "635N"; // Change this to your station's stop_id
const MTA_GTFS_URL = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs";

async function fetchGTFS() {
    document.getElementById("status").innerText = "Updating..."; // Show update message

    try {
        // Fetch GTFS-RT feed
        const response = await fetch(MTA_GTFS_URL);
        const data = await response.arrayBuffer();
      

        // Load protobuf schema
        const root = await protobuf.load("https://raw.githubusercontent.com/google/transit/master/gtfs-realtime/proto/gtfs-realtime.proto");
        const FeedMessage = root.lookupType("transit_realtime.FeedMessage");

        // Decode GTFS-RT data
        const message = FeedMessage.decode(new Uint8Array(data));
        console.log("Decoded GTFS-RT data:", message);

        // Extract real-time arrivals
        let arrivals = extractStationArrivals(message, STATION_STOP_ID);
        console.log("Arrivals:", arrivals);
        

        // Update the table
        updateTable(arrivals);
    } catch (error) {
        console.error("Error fetching GTFS data:", error);
        document.getElementById("train-arrivals").innerHTML = `<tr><td colspan="2">Error loading data.</td></tr>`;
    }

    document.getElementById("status").innerText = `Last updated: ${new Date().toLocaleTimeString()}`;
}

function extractStationArrivals(message, stopId) {
    let arrivals = [];

    message.entity.forEach(entity => {
        if (entity.tripUpdate) {
            entity.tripUpdate.stopTimeUpdate.forEach(update => {
                if (update.stopId === stopId && new Date().toLocaleTimeString() < new Date(update.arrival.time * 1000).toLocaleTimeString()) {
                    let arrivalTime = new Date(update.arrival.time * 1000); // Convert Unix timestamp
                    // console.log("Route:", entity.tripUpdate.trip.routeId || "Unknown", "Arrival Time:", arrivalTime);

                    arrivals.push({
                        route: entity.tripUpdate.trip.routeId || "Unknown",
                        arrival: arrivalTime
                    });
                }
            });
        }
    });
    
    // Sort by soonest arrival
    return arrivals.sort((a, b) => a.arrival.toLocaleTimeString() - b.arrival.toLocaleTimeString());
}

function updateTable(arrivals) {
    let tableBody = document.getElementById("train-arrivals");
    tableBody.innerHTML = ""; // Clear old rows

    if (arrivals.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="2">No upcoming trains.</td></tr>`;
        return;
    }

    arrivals.forEach(train => {
        let row = `<tr>
            <td>${train.route}</td>
            <td>${train.arrival.toLocaleTimeString()}</td>
        </tr>`;
        tableBody.innerHTML += row;
    });
}

let trainPositions = {};  // Store the positions of the trains

// Function to update the train positions based on the route and arrival time
function updateTrainPosition(route, arrivalTime) {
    const routeLine = document.getElementById(`route-${route}`);  // Get the route line
    const circle = document.getElementById(`train-${route}`);  // Get the corresponding circle
    const currentTime = new Date().getTime() / 1000;  // Get the current time in seconds
    const timeRemaining = arrivalTime - currentTime;  // Calculate the time remaining for the train

    if (timeRemaining <= 0) {
        return;  // If the train has already arrived, don't update
    }

    // Position the circle based on the time remaining (this is just an example logic)
    const position = 1280 * (1 - (timeRemaining / 300));  // Assuming 300 seconds as the max travel time (just an example)

    // Update the circle position (cx attribute for horizontal movement)
    circle.setAttribute('cx', position);
}

// Function to update all trains in real-time
function updateTrains(arrivals) {
    arrivals.forEach(train => {
        // Call updateTrainPosition for each train in the arrivals array
        updateTrainPosition(train.route, train.arrival.getTime() / 1000);  // Convert arrival time to Unix timestamp (seconds)
    });
}

// Sample data structure for arrivals
const arrivals = [
    { route: 1, arrival: new Date(Date.now() + 5000) },  // Train arriving in 5 seconds
    { route: 2, arrival: new Date(Date.now() + 10000) }, // Train arriving in 10 seconds
    { route: 3, arrival: new Date(Date.now() + 15000) }  // Train arriving in 15 seconds
];

// Start the real-time updates (this would normally come from GTFS-RT feed)
setInterval(() => {
    updateTrains(arrivals);
}, 1000);  // Update every second


window.onload = function () {
    fetchGTFS(); // Initial fetch
    setInterval(fetchGTFS, 30000); // Refresh every 30 sec
};
