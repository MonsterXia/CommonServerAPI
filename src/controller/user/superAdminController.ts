import {
    setAdminParser,
    setAdminService
} from "@/service/user/superAdminService";
import { createValidatedHandler } from '@/controller/handlers';

class superAdminController {
    public static setUserAsAdmin = createValidatedHandler(
        setAdminParser,
        setAdminService,
        'Set User As Admin Failed',
    );
}

export default superAdminController;
