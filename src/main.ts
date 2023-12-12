import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet, { LatLng, Marker } from "leaflet";
import luck from "./luck";
import "./leafletWorkaround";
import { Board, Point, Geocache, Geocoin } from "./board.ts";

class Player {
    position: Point;
    marker: Marker;
    coins: Geocoin[];

    constructor(position: Point, marker: Marker) {
        this.position = position;
        this.marker = marker;
        this.coins = [];
    }

    getNumCoins(): number {
        return this.coins.length;
    }
    addCoin(coin: Geocoin) {
        this.coins.push(coin);
    }
    removeCoin(): Geocoin | null {
        if (this.coins.length > 0) {
            return this.coins.pop()!;
        } else {
            return null;
        }
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

const mapContainer = document.querySelector<HTMLElement>("#map")!;

const map = leaflet.map(mapContainer, {
    center: MERRILL_CLASSROOM,
    zoom: GAMEPLAY_ZOOM_LEVEL,
    minZoom: GAMEPLAY_ZOOM_LEVEL,
    maxZoom: GAMEPLAY_ZOOM_LEVEL,
    zoomControl: false,
    scrollWheelZoom: false
});

const board: Board = new Board();

const player: Player = getPlayer(MERRILL_CLASSROOM);

leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; <a href=\"http://www.openstreetmap.org/copyright\">OpenStreetMap</a>"
}).addTo(map);

const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No coins yet...";

function getPlayer(startingLatLng: LatLng) {
    const playerMarker = leaflet.marker(startingLatLng);
    playerMarker.bindTooltip("That's you!");
    playerMarker.addTo(map);
    return new Player(latLngToPoint(startingLatLng), playerMarker);
}

function makeCacheRect(position: Point) {
    const bounds = leaflet.latLngBounds([
        [position.i * TILE_DEGREES,
        position.j * TILE_DEGREES],
        [(position.i + 1) * TILE_DEGREES,
        (position.j + 1) * TILE_DEGREES],
    ]);

    const geocacheRect = leaflet.rectangle(bounds) as leaflet.Layer;
    const geocache = board.getGeocacheAt(position);

    geocacheRect.bindPopup(() => {
        const container = document.createElement("div");
        container.innerHTML = `
                                <div>
                                There is a cache here at "${position.i},${position.j}". It has <span id="numCoins">${geocache.getNumCoins()}</span> 
                                coin<span id="coinPlural">${geocache.getNumCoins() != 1 ? "s" : ""}</span>.
                                </div>
                                <button id="take">take</button>
                                <button id="put">put</button>`;
        geocache.getCoinStrings().forEach(coinString => {
            const coinDiv = document.createElement("div");
            coinDiv.textContent = coinString;
            container.appendChild(coinDiv);
        });
        const takeButton = container.querySelector<HTMLButtonElement>("#take")!;
        const putButton = container.querySelector<HTMLButtonElement>("#put")!;
        takeButton.addEventListener("click", () => {
            const takenCoin = geocache.takeCoin();
            if (takenCoin != null) {
                player.addCoin(takenCoin);
                container.removeChild(container.lastChild!);
                container.querySelector<HTMLSpanElement>("#numCoins")!.innerHTML = geocache.getNumCoins().toString();
                container.querySelector<HTMLSpanElement>("#coinPlural")!.innerHTML = geocache.getNumCoins() != 1 ? "s" : "";
            }
            statusPanel.innerHTML = `${player.getNumCoins()} coins accumulated`;
        });
        putButton.addEventListener("click", () => {
            const coinToPut = player.removeCoin();
            if (coinToPut != null) {
                geocache.putCoin(coinToPut);
                const coinDiv = document.createElement("div");
                coinDiv.textContent = Geocache.getCoinString(coinToPut);
                container.appendChild(coinDiv);
                container.querySelector<HTMLSpanElement>("#numCoins")!.innerHTML = geocache.getNumCoins().toString();
                container.querySelector<HTMLSpanElement>("#coinPlural")!.innerHTML = geocache.getNumCoins() != 1 ? "s" : "";
            }
            statusPanel.innerHTML = `${player.getNumCoins()} coins accumulated`;
        });
        return container;
    });
    geocacheRect.addTo(map);
}

for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
    for (let j = - NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
        if (luck([i, j].toString()) < PIT_SPAWN_PROBABILITY) {
            makeCacheRect(addPoints(player.position, { i, j }));
        }
    }
}

function latLngToPoint(latLng: LatLng):Point {
    return { i: Math.round(latLng.lat / TILE_DEGREES), j: Math.round(latLng.lng / TILE_DEGREES) };
}

function addPoints(a: Point, b: Point): Point {
    return { i: a.i + b.i, j: a.j + b.j };
}