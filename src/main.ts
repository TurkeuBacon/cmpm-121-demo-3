import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet, { Layer } from "leaflet";
import luck from "./luck";
import "./leafletWorkaround";

interface Point{
    i: number;
    j: number;
}

class Geocache {
    position: Point;
    layer: Layer;
    value: number;

    constructor(position: Point, layer: Layer) {
        this.position = position;
        this.layer = layer;
        this.value = Math.floor(luck([position.i, position.j, "initialValue"].toString()) * 100);
    }

    getValue(): number {
        return this.value;
    }
    takeCoin() {
        if (this.value > 0) {
            this.value--;
            return true;
        }
        return false;
    }
    putCoin() {
        this.value++;
    }
}

const MERRILL_CLASSROOM = leaflet.latLng({
    lat: 36.9995,
    lng: - 122.0533
});

const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const PIT_SPAWN_PROBABILITY = 0.1;

const caches = new Map<Point, Geocache>();

const mapContainer = document.querySelector<HTMLElement>("#map")!;

const map = leaflet.map(mapContainer, {
    center: MERRILL_CLASSROOM,
    zoom: GAMEPLAY_ZOOM_LEVEL,
    minZoom: GAMEPLAY_ZOOM_LEVEL,
    maxZoom: GAMEPLAY_ZOOM_LEVEL,
    zoomControl: false,
    scrollWheelZoom: false
});

leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; <a href=\"http://www.openstreetmap.org/copyright\">OpenStreetMap</a>"
}).addTo(map);

const playerMarker = leaflet.marker(MERRILL_CLASSROOM);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

let points = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No points yet...";

function makeCache(position: Point): Geocache {
    const bounds = leaflet.latLngBounds([
        [MERRILL_CLASSROOM.lat + position.i * TILE_DEGREES,
        MERRILL_CLASSROOM.lng + position.j * TILE_DEGREES],
        [MERRILL_CLASSROOM.lat + (position.i + 1) * TILE_DEGREES,
        MERRILL_CLASSROOM.lng + (position.j + 1) * TILE_DEGREES],
    ]);

    const pit = leaflet.rectangle(bounds) as leaflet.Layer;
    const cache = new Geocache(position, pit);

    pit.bindPopup(() => {
        const container = document.createElement("div");
        container.innerHTML = `
                <div>
                There is a cache here at "${position.i},${position.j}". It has <span id="value">${cache.getValue()}</span> 
                coin<span id="coinPlural">${cache.getValue() != 1 ? "s" : ""}</span>.
                </div>
                <button id="take">take</button>
                <button id="put">put</button>`;
        const takeButton = container.querySelector<HTMLButtonElement>("#take")!;
        const putButton = container.querySelector<HTMLButtonElement>("#put")!;
        takeButton.addEventListener("click", () => {
            if (cache.takeCoin()) {
                container.querySelector<HTMLSpanElement>("#value")!.innerHTML = cache.getValue().toString();
                container.querySelector<HTMLSpanElement>("#coinPlural")!.innerHTML = cache.getValue() != 1 ? "s" : "";
                points++;
                statusPanel.innerHTML = `${points} points accumulated`;
            }
        });
        putButton.addEventListener("click", () => {
            cache.putCoin();
            container.querySelector<HTMLSpanElement>("#value")!.innerHTML = cache.getValue().toString();
            container.querySelector<HTMLSpanElement>("#coinPlural")!.innerHTML = cache.getValue() != 1 ? "s" : "";
            points++;
            statusPanel.innerHTML = `${points} points accumulated`;
        });
        return container;
    });
    pit.addTo(map);
    return cache;
}

for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
    for (let j = - NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
        const position: Point = { i, j };
        if (luck([i, j].toString()) < PIT_SPAWN_PROBABILITY) {
            caches.set(position, makeCache(position));
        }
    }
}