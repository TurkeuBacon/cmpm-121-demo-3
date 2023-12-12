import luck from "./luck";

export interface Point{
    i: number;
    j: number;
}
function pointToString(point: Point) {
    return point.i + ":" + point.j;
}

export interface Geocoin {
    origin: Point
    id: number
}

interface Memento<T> {
    toMemento(): T
    fromMemento(memento: T): void
}

export class Geocache implements Memento<string> {
    position: Point;
    coins: Geocoin[];

    constructor(position: Point, memento: string | null = null) {
        this.position = position;
        this.coins = [];
        if (memento == null) {
            const numCoins = Math.floor(luck([position.i, position.j, "initialValue"].toString()) * 10);
            for (let i = 0; i < numCoins; i++) {
                this.coins.push({ origin: position, id: i });
            }
        } else {
            this.fromMemento(memento);
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

    toMemento(): string {
        return JSON.stringify(this.coins);
    }
    fromMemento(memento: string): void {
        this.coins = JSON.parse(memento) as Geocoin[];

    }
}

export class Board {

    geocacheMementos: Map<string, string>;
    knownCaches: Map<string, Geocache>;

    constructor() {
        this.knownCaches = new Map<string, Geocache>();
        this.geocacheMementos = new Map<string, string>();
    }

    clearKnownCaches() {
        this.knownCaches.forEach(geocache => {
            this.geocacheMementos.set(pointToString(geocache.position), geocache.toMemento());
        });
        this.knownCaches.clear();
    }

    getGeocacheAt(position: Point): Geocache {
        const positionString: string = pointToString(position);
        if (!this.knownCaches.has(positionString)) {
            let memento: string | null = null;
            if (this.geocacheMementos.has(positionString)) {
                memento = this.geocacheMementos.get(positionString)!;
            }
            this.knownCaches.set(positionString, new Geocache(position, memento));
        }
        return this.knownCaches.get(positionString)!;
    }

}