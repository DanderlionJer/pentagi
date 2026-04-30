import { ApolloError } from '@apollo/client';

/** First GraphQL error message, else Error.message, else fallback. */
export function getApolloErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof ApolloError) {
        const gqlMsg = error.graphQLErrors?.[0]?.message;
        if (gqlMsg) {
            return gqlMsg;
        }
        if (error.message) {
            return error.message;
        }
    }
    if (error instanceof Error) {
        return error.message;
    }
    return fallback;
}

/** Backend returns 404-style copy when the flow row is missing or inaccessible. */
export function isFlowMissingError(message: string): boolean {
    const m = message.toLowerCase();
    return m.includes('flow not found') || m.includes('flows.notfound');
}
