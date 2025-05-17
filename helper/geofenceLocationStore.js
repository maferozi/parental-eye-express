const { Location, Geofence, GeofenceDevice } = require("../models");
const turf = require("@turf/turf");
const { sendNotification } = require("./notificationHelper");

async function saveGeofenceLocation(associatedUserIds, deviceId, latitude, longitude, receivedAt) {
    try {
        // Fetch all geofences assigned to this device
        const geofences = await Geofence.findAll({
            include: [
                {
                    model: GeofenceDevice,
                    as: "geofenceDevices",
                    where: { device_id: deviceId },
                },
            ],
        });

        const geoJsons = {
            type: "Point",
            coordinates: [longitude, latitude],
        };

        if (!geofences.length) {
            console.log(`⚠️ Device ${deviceId} is NOT assigned to any geofence.`);
            await Location.create({
                device_id: deviceId,
                location: geoJsons, // Pass GeoJSON object
                location_status: 1,
                received_at: receivedAt,
            });
            console.log("✅ Location saved:");
        }
        else{
        // Convert current location to a GeoJSON point
        const point = turf.point([longitude, latitude]);
        let isSafe = false;

        // Check location against each assigned geofence
        for (const geofence of geofences) {
            if (geofence.type === "circle" && geofence.center && geofence.radius) {
                const center = turf.point(geofence.center.coordinates);
                const distance = turf.distance(center, point, { units: "meters" });

                if (distance <= geofence.radius) {
                    isSafe = true;
                    break;
                }
            }

            if (geofence.type === "route" && geofence.path) {
                const route = turf.lineString(geofence.path.coordinates);
                const nearest = turf.nearestPointOnLine(route, point, { units: 'meters' });

                // Allow a threshold of 20 meters
                if (nearest.properties.dist <= 20) {
                    isSafe = true;
                    break;
                }
            }

            if (geofence.type === "area" && geofence.area) {
                const area = turf.polygon(geofence.area.coordinates);
                if (turf.booleanPointInPolygon(point, area)) {
                    isSafe = true;
                    break;
                }
            }
        }

        // Determine location status
        const locationStatus = isSafe ? 1 : 2;
        if (!isSafe) {
            await Promise.all(
              associatedUserIds.map(userId =>
                sendNotification({
                  userId,
                  type: "Geofence Alert",
                  data: {
                    deviceId,
                    location: { latitude, longitude },
                  },
                })
              )
            );
          }
          
        // Convert to GeoJSON
        const geoJson = {
            type: "Point",
            coordinates: [longitude, latitude], // GeoJSON expects [longitude, latitude]
        };

        // Save to database
        await Location.create({
            device_id: deviceId,
            location: geoJson,
            location_status: locationStatus,
            received_at: receivedAt,
        });

        console.log(`✅ Location saved for Device ${deviceId} | Status: ${locationStatus === 1 ? "Safe" : "Danger"}`);
    }
    } catch (error) {
        console.error("❌ Error saving geofence location:", error);
    }
}

module.exports = { saveGeofenceLocation };
