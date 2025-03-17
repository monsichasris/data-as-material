
let STATION_STOP_ID = "635"; // Default stop ID (14 St-Union Sq: downtown)
let DIRECTION = "S"; // Default direction (downtown)
const MTA_GTFS_URL = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs";

// Load stations from JSON file and populate dropdown menu
async function loadStations() {
    try {
        const response = await fetch('stations.json');
        const stations = await response.json();
        populateDropdown(stations);
    } catch (error) {
        console.error("Error loading stations:", error);
    }
}

// Populate dropdown menu with stations
function populateDropdown(stations) {
    const dropdown = document.getElementById('station-select');
    const stationArray = Object.entries(stations).sort((a, b) => a[1].name.localeCompare(b[1].name));
    for (const [id, station] of stationArray) {
        const option = document.createElement('option');
        option.value = id;
        option.text = station.name;
        if (id === STATION_STOP_ID) {
            option.selected = true; // Set the default selection
        }
        dropdown.add(option);
    }
}


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
        let arrivals = extractStationArrivals(message, STATION_STOP_ID + DIRECTION);

        // Update the table
        updateTable(arrivals);

        // Update train positions
        arrivals.forEach(train => {
            updateTrain(train.id, train.route, train.arrival.getTime() / 1000);  // Convert arrival time to Unix timestamp (seconds)
        });

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
                        // id: entity.id,
                        id: entity.tripUpdate.trip.tripId.replace(/\./g, "-"),
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

function updateTrain(id, route, arrivalTime) {
    let circle = d3.select(`#train-${id}`);
    let text = d3.select(`#text-${id}`);
    if (circle.empty()) {
        console.log(`Creating new circle for trainId: ${id}`);
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
                                return 200;
                        }
                    })
                    .attr('fill', () => {
                        switch (route) {
                            // case '4':
                            //     return 'red';
                            // case '5':
                            //     return 'yellow';
                            // case '6':
                            //     return 'blue';
                            default:
                                return '#00933C'; // green for 456 lines
                        }
                    });
                    text = d3.select('svg').append('text')
                            .attr('id', `text-${id}`)
                            .attr('y', circle.attr('cy'))
                            .attr('dy', '.35em')
                            .attr('text-anchor', 'middle')
                            .attr('fill', 'white')
                            .style('font-family', 'Helvetica')
                            .style('font-weight', 'bold')
                            .style('font-size', '20px')
                            .text(route);
        trainPositions[id] = 0;
    }

    const currentTime = new Date().getTime() / 1000;
    const timeRemaining = arrivalTime - currentTime;  // Calculate time remaining for train arrival

    const maxTravelTime = 100; // 3 minutes max travel time
    const maxWidth = window.innerWidth;

    // D3 scale: Map time remaining to position along the route
    const xScale = d3.scaleLinear()
        .domain([0, maxTravelTime])  // Time range (0 = arrival, maxTravelTime = farthest away)
        .range([0,maxWidth]);

    // Compute new position
    const position = xScale(Math.max(0, timeRemaining));
    
    circle.attr('cx', timeRemaining); // Update the x position of the circle
    text.attr('x', `${timeRemaining}`); // Update the x position

    // Play sound if the position is 0
    if (timeRemaining < 1) {
        playSound();
    }

    trainPositions[id] = position;
    
    // console.log(`Route: ${route}, Id: ${id}, Time Remaining: ${timeRemaining.toFixed(2)}, Position: ${position.toFixed(2)}`);
}


function playSound() {
    var audio = new Audio('pew.mp3');
    audio.play();
}


// Start the real-time updates using the feed data
setInterval(async () => {
    const message = await fetchGTFS();  // Fetch GTFS data
    if (message) {  // Ensure data is valid
        const arrivals = extractStationArrivals(message, STATION_STOP_ID+DIRECTION);
        arrivals.forEach(train => {
            updateTrain(train.id, train.route, train.arrival.getTime() / 1000);  // Convert arrival time to Unix timestamp (seconds)
        });
    }
}, 1000);   // Update every second


window.onload = function () {
    loadStations(); 
    fetchGTFS(); // Initial fetch
    setInterval(fetchGTFS, 10000); // Refresh every 10 sec

    document.getElementById('station-select').addEventListener('change', function() {
        STATION_STOP_ID = this.value;
        fetchGTFS(); // Fetch data for the selected station
    });

    document.getElementById('direction-select').addEventListener('change', function() {
        DIRECTION = this.value;
        fetchGTFS(); // Fetch data for the selected direction
    });
}