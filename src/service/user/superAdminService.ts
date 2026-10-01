import { Context } from "hono";
import { StandardServerResult } from "@/model/util/hono";
import { checkUsernameExistService } from "./userService";
import { buildStandardServerResponse, businessStatusCode } from "@/util/hono";
import { getPrismaClient } from "@/lib/prisma";
import { SetSuperAdminRequestPayload } from "@/model/user/superAdmin";

export const setAdminParser = (data: any): StandardServerResult<SetSuperAdminRequestPayload | null> => {
    if (!data || typeof data.username !== 'string' || !data.username.trim()) {
        return buildStandardServerResponse(
            false,
            'Missing username',
            null,
            null,
            businessStatusCode.BAD_REQUEST
        );
    }
    return buildStandardServerResponse(
        true,
        'Parse request payload successfully',
        {
            username: data.username.toString()
        },
        null,
        businessStatusCode.OK
    );
}

export const setAdminService = async (c: Context, data: SetSuperAdminRequestPayload): Promise<StandardServerResult<null>> => {
    try {
        const { username } = data;
        const exist = await checkUsernameExistService(c, username);
        if (!exist.success) {
            return buildStandardServerResponse(
                false,
                'User does not exist',
                null,
                null,
                businessStatusCode.NOT_FOUND
            );
        }

        const foundUser = await getPrismaClient().user.findUnique({
            where: {
                username
            }
        })

        foundUser!.isAdmin = true;
        const updatedUser = await getPrismaClient().user.update({
            where: {
                username
            },
            data: foundUser!
        })
        if (!updatedUser) {
            return buildStandardServerResponse(
                false,
                'Failed to set admin status',
                null,
                null,
                businessStatusCode.INTERNAL_SERVER_ERROR
            );
        }
        // Simulate setting admin status for the user
        return buildStandardServerResponse(
            true,
            'Admin status set successfully',
            null,
            null,
            businessStatusCode.OK
        );
    } catch (error) {
        return buildStandardServerResponse(
            false,
            'Error setting admin status',
            null,
            null,
            businessStatusCode.INTERNAL_SERVER_ERROR
        );
    }
}
