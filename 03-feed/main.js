
const STATION_STOP_ID = "635N";
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

        // Extract real-time arrivals
        let arrivals = extractStationArrivals(message, STATION_STOP_ID);

        // Update the table
        updateTable(arrivals);

        return message;
        
    } catch (error) {
        console.error("Error fetching GTFS data:", error);
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

                    arrivals.push({
                        id: entity.id,
                        route: entity.tripUpdate.trip.routeId || "Unknown",
                        arrival: arrivalTime
                    });
                    
                }
                // console.log(arrivals);
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

function updateTrainPosition(id, route, arrivalTime) {

    let circle = d3.select(`#train-${id}`);
    if (circle.empty()) {
        circle = d3.select('svg').append('circle')
            .attr('id', `train-${id}`)
            .attr('r', 20) 
            .attr('cy', () => {
                switch (route) {
                    case '4':
                        return 50;
                    case '5':
                        return 100;
                    case '6':
                        return 150;
                    default:
                        return 200;  // Default position for other routes
                }
            })
            .attr('fill', () => {
                switch (route) {
                    case '4':
                        return '#00933C'; // green
                    case '5':
                        return 'yellow';
                    case '6':
                        return 'blue';
                    default:
                        return 'red';  // Default color for other routes
                }
            });
        trainPositions[id] = 0;
    }

    const currentTime = new Date().getTime() / 1000;
    const timeRemaining = arrivalTime - currentTime;  // Calculate time remaining for train arrival

    const maxTravelTime = 300; // 3 minutes max travel time
    const maxWidth = window.innerWidth;

    // D3 scale: Map time remaining to position along the route
    const xScale = d3.scaleLinear()
        .domain([maxTravelTime, 0])  // Time range (0 = arrival, maxTravelTime = farthest away)
        .range([maxWidth, 0]);

    // Compute new position
    const position = xScale(Math.max(0, timeRemaining));

    const positionPercentage = (position / maxWidth) * 100;

    console.log(`Route: ${route}, Time Remaining: ${timeRemaining.toFixed(2)}, Position: ${position}`);

    // Update the circle position using D3 transition for smooth movement
    circle.transition()
        .duration(1000)  // Smooth movement every second
        .ease(d3.easeLinear)  // Keep linear movement
        .attr('cx', positionPercentage); // Update the x position of the circle
    trainPositions[id] = position;
}



// Function to update all trains in real-time
function updateTrains(message, arrivals) {
    console.log('updateTrains called with arrivals:', arrivals);
    arrivals.forEach(train => {
        // Call updateTrainPosition for each train in the arrivals array
        updateTrainPosition(train.id, train.route, train.arrival.getTime() / 1000);  // Convert arrival time to Unix timestamp (seconds)
        console.log(train.route, train.arrival.getTime() / 1000);
    });
}

// Start the real-time updates using the feed data
setInterval(async () => {
    console.log('Fetching GTFS data...');
    const message = await fetchGTFS();  // Fetch GTFS data
    if (message) {  // Ensure data is valid
        const arrivals = extractStationArrivals(message, STATION_STOP_ID);
        console.log('Extracted arrivals:', arrivals);
        updateTrains(message, arrivals);  // Call update function with data
    }
}, 1000);   // Update every second


window.onload = function () {
    fetchGTFS(); // Initial fetch
    setInterval(fetchGTFS, 10000); // Refresh every 10 sec
};
