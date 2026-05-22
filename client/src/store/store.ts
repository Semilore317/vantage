import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import dashboardReducer from "./dashboardSlice";
import graphReducer from "./graphSlice";
import flaggedReducer from "./flaggedSlice";

export const store = configureStore({
    reducer : {
        auth : authReducer,
        dashboard: dashboardReducer,
        graph: graphReducer,
        flagged: flaggedReducer,
    }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
