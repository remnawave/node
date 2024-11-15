export class RemoveUserResponseModel {
    success: boolean;
    error: string | null;

    constructor(success: boolean, error: string | null) {
        this.success = success;
        this.error = error;
    }
}
