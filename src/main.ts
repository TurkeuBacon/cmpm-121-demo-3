import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet, { LatLng, Layer, Marker, Polyline } from "leaflet";
import luck from "./luck";
import "./leafletWorkaround";
import { Board, Point, Geocache, Geocoin, Memento } from "./board.ts";

class Player implements Memento<string>{
    position: Point;
    marker: Marker;
    coins: Geocoin[];
    locationHistory: LatLng[];

    constructor(position: Point, marker: Marker, memento: string | null = null) {
        this.position = position;
        this.marker = marker;
        this.coins = [];
        this.locationHistory = [pointToLatLng(this.position)];
        if (memento != null) {
            this.fromMemento(memento);
        }
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
    setPosition(position: Point) {
        this.position = position;
        this.marker.setLatLng(pointToLatLng(this.position));
        this.locationHistory.push(pointToLatLng(this.position));
    }
    clearCoins() {
        this.coins = [];
    }

    toMemento(): string {
        return JSON.stringify({
            position: this.position,
            locationHistory: this.locationHistory,
            coins: this.coins
        });
    }
    fromMemento(memento: string): void {
        const mementoObj = JSON.parse(memento) as {
            position: Point
            locationHistory: LatLng[]
            coins: Geocoin[]
        };
        this.setPosition(mementoObj.position);
        this.locationHistory = mementoObj.locationHistory;
        this.coins = mementoObj.coins;
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

const PLAYER_DATA_KEY = "player_data";
const BOARD_DATA_KEY = "board_data";

const mapContainer = document.querySelector<HTMLElement>("#map")!;

const map = leaflet.map(mapContainer, {
    center: MERRILL_CLASSROOM,
    zoom: GAMEPLAY_ZOOM_LEVEL,
    zoomControl: false,
    scrollWheelZoom: false
});

const boardMemento: string | null = localStorage.getItem(BOARD_DATA_KEY);

const board: Board = new Board(boardMemento);
let neighborhoodRects: Layer[] = [];

const player: Player = getPlayer(MERRILL_CLASSROOM);
let polyline: Polyline | null;
let geolocationWatcherId: number | null;
map.panTo(pointToLatLng(player.position));
getNeighborhood();
drawPlayerHistory();
let zoomedOut = false;

leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; <a href=\"http://www.openstreetmap.org/copyright\">OpenStreetMap</a>"
}).addTo(map);

const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = `${player.getNumCoins()} coins accumulated`;

function getPlayer(startingLatLng: LatLng) {
    const playerMemento: string | null = localStorage.getItem(PLAYER_DATA_KEY);
    const playerMarker = leaflet.marker(startingLatLng);
    playerMarker.bindTooltip("That's you!");
    playerMarker.addTo(map);
    return new Player(latLngToPoint(startingLatLng), playerMarker, playerMemento);
}

function makeCacheRect(position: Point): Layer {
    const bounds = leaflet.latLngBounds([
        [position.i * TILE_DEGREES,
        position.j * TILE_DEGREES],
        [(position.i + 1) * TILE_DEGREES,
        (position.j + 1) * TILE_DEGREES],
    ]);

    const geocacheRect = leaflet.rectangle(bounds) as Layer;
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
    return geocacheRect;
}

document.getElementById("sensor")!.addEventListener("click", () => {
    if (geolocationWatcherId == null) {
        useGeolocation();
    } else {
        ignoreGeolocation();
    }
});
document.getElementById("north")!.addEventListener("click", () => {
    movePlayerManual({ i: 1, j: 0 });
});
document.getElementById("east")!.addEventListener("click", () => {
    movePlayerManual({ i: 0, j: 1 });
});
document.getElementById("south")!.addEventListener("click", () => {
    movePlayerManual({ i: -1, j: 0 });
});
document.getElementById("west")!.addEventListener("click", () => {
    movePlayerManual({ i: 0, j: -1 });
});
document.getElementById("reset")!.addEventListener("click", () => {
    if (confirm("Reset your game progress?")) {
        board.reset();
        player.clearCoins();
        player.locationHistory = [];
        ignoreGeolocation();
        setPlayerPosition(latLngToPoint(MERRILL_CLASSROOM));
        statusPanel.innerHTML = `${player.getNumCoins()} coins accumulated`;
    }
});
document.getElementById("zoom")!.addEventListener("click", () => {
    if (zoomedOut) {
        zoomIn();
    } else {
        zoomOut();
    }
});

getNeighborhood();

function setPlayerPosition(position: Point) {
    player.setPosition(position);
    map.panTo(pointToLatLng(player.position));
    getNeighborhood();
    drawPlayerHistory();
    zoomIn();
    saveGame();
}

function movePlayerManual(delta: Point) {
    ignoreGeolocation();
    const newPosition = addPoints(player.position, delta);
    setPlayerPosition(newPosition);
}

function drawPlayerHistory() {
    if (polyline != null) {
        polyline.remove();
    }
    polyline = leaflet.polyline(player.locationHistory, { color: "blue" }).addTo(map);
}

function useGeolocation() {
    if (geolocationWatcherId != null) navigator.geolocation.clearWatch(geolocationWatcherId);
    geolocationWatcherId = navigator.geolocation.watchPosition((position) => {
        const newPosition: Point = latLngToPoint(leaflet.latLng({ lat: position.coords.latitude, lng: position.coords.longitude }));
        setPlayerPosition(newPosition);
    });
}
function ignoreGeolocation() {
    if (geolocationWatcherId == null) {
        return;
    }
    navigator.geolocation.clearWatch(geolocationWatcherId);
    geolocationWatcherId = null;
}

function getNeighborhood() {
    neighborhoodRects.forEach(rect => {
        rect.remove();
    });
    neighborhoodRects = [];
    board.clearKnownCaches();
    for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
        for (let j = - NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
            const globalPos: Point = addPoints(player.position, { i, j });
            if (luck([globalPos.i, globalPos.j].toString()) < PIT_SPAWN_PROBABILITY) {
                neighborhoodRects.push(makeCacheRect(globalPos));
            }
        }
    }
}
function zoomOut() {
    if (zoomedOut) return;
    if (polyline != null) {
        zoomedOut = true;
        map.fitBounds(polyline.getBounds(), {duration: .125});
    }
}

function zoomIn() {
    if (!zoomedOut) return;
    zoomedOut = false;
    map.flyTo(pointToLatLng(player.position), GAMEPLAY_ZOOM_LEVEL, {duration: .125});
}

function saveGame() {
    localStorage.setItem(PLAYER_DATA_KEY, player.toMemento());
    localStorage.setItem(BOARD_DATA_KEY, board.toMemento());
}

function latLngToPoint(latLng: LatLng): Point {
    return { i: Math.round(latLng.lat / TILE_DEGREES), j: Math.round(latLng.lng / TILE_DEGREES) };
}
function pointToLatLng(point: Point): LatLng {
    return leaflet.latLng({ lat: point.i * TILE_DEGREES, lng: point.j * TILE_DEGREES });
}

function addPoints(a: Point, b: Point): Point {
    return { i: a.i + b.i, j: a.j + b.j };
}