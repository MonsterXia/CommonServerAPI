import { Context } from "hono";

class skLandController {
    public static checkIn = async (c: Context) =>{
        try {
            const {phone, password} = await c.req.json();
            console.log(`Phone: ${phone}, Password: ${password}`);

            return c.json({ 
                message: "SK Island Check-In endpoint" 
            }, 200);
        }catch (e) {
            c.json({
                message: "Sk Island Check-In Error",
                error: e,
            }, 500);
        }
    }

    public static hypergryphPasswordLogin = async (c: Context) => {
        try {
            const {phone, password} = await c.req.json();
            console.log(`Phone: ${phone}, Password: ${password}`);
            
            return c.json({ 
                message: "SK Island Hypergryph Password Login endpoint" 
            }, 200);
        }catch (e) {
            c.json({
                message: "Sk Island Hypergryph Password Login Error",
                error: e,
            }, 500);
        }
    }
}

export default skLandController;