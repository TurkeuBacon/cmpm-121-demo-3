import luck from "./luck";

export interface Point{
    i: number;
    j: number;
}

export interface Geocoin {
    origin: Point
    id: number
}

export class Geocache {
    position: Point;
    coins: Geocoin[];

    constructor(position: Point) {
        this.position = position;
        this.coins = [];

        const numCoins = Math.floor(luck([position.i, position.j, "initialValue"].toString()) * 10);
        for (let i = 0; i < numCoins; i++) {
            this.coins.push({ origin: position, id: i });
        }

    }
    getNumCoins(): number {
        return this.coins.length;
    }
    getCoinStrings(): string[] {
        return this.coins.map((coin) => {
            return Geocache.getCoinString(coin);
        });
    }
    takeCoin(): Geocoin | null {
        if (this.coins.length > 0) {
            return this.coins.pop()!;
        }
        return null;
    }
    putCoin(coin: Geocoin): void {
        this.coins.push(coin);
    }
    static getCoinString(coin: Geocoin): string {
        return "(" + coin.origin.i + ", " + coin.origin.j + ")#" + coin.id;
    }
}

export class Board {

    knownCaches: Map<Point, Geocache>;

    constructor() {
        this.knownCaches = new Map<Point, Geocache>();
    }

    getGeocacheAt(position: Point): Geocache {
        if (!this.knownCaches.has(position)) {
            this.knownCaches.set(position, new Geocache(position));
        }
        return this.knownCaches.get(position)!;
    }

}