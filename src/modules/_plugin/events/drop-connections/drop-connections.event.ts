export class DropConnectionsEvent {
    constructor(public readonly ips: string[] | null) {}
}
