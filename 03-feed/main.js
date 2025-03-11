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
                if (update.stopId === stopId) {
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
    return arrivals.sort((a, b) => a.arrival - b.arrival);
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

window.onload = function () {
    fetchGTFS(); // Initial fetch
    setInterval(fetchGTFS, 30000); // Refresh every 30 sec
};
