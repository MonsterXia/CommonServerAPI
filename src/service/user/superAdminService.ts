import { Context } from "hono";
import { StandardServerResult } from "@/model/util/hono";
import { checkUsernameExistService } from "./userService";
import { buildStandardServerResponse, bussinessStatusCode } from "@/util/hono";
import { getPrismaClient } from "@/lib/prisma";
import { SetSuperAdminRequestPayload } from "@/model/user/superAdmin";

export const setAdminParser = (data: any): StandardServerResult<SetSuperAdminRequestPayload | null> => {
    if (!data.username) {
        return buildStandardServerResponse(
            false,
            'Missing username',
            null,
            bussinessStatusCode.BAD_REQUEST
        );
    }
    return buildStandardServerResponse(
        true,
        'Parse request payload successfully',
        {
            username: data.username.toString()
        },
        bussinessStatusCode.OK
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
                bussinessStatusCode.NOT_FOUND
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
                bussinessStatusCode.INTERNAL_SERVER_ERROR
            );
        }
        // Simulate setting admin status for the user
        return buildStandardServerResponse(
            true,
            'Admin status set successfully',
            null,
            bussinessStatusCode.OK
        );
    } catch (error) {
        return buildStandardServerResponse(
            false,
            'Error setting admin status',
            null,
            bussinessStatusCode.INTERNAL_SERVER_ERROR
        );
    }
}