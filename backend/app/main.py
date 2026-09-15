import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import ensure_indexes
from app.routers import dashboard, defects, events, fleet, health, insights, routes, simulator
from app.services.routes_seed import ensure_routes_seeded

logging.basicConfig(level=logging.INFO)

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    ensure_indexes()
    ensure_routes_seeded()
    yield


app = FastAPI(
    title="Fleet Sensing Control API",
    description="SIH26124 -- AI-powered mobile urban intelligence platform using public "
    "transport fleet. Backend for the internal-hackathon prototype.",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)

api_v1 = APIRouter(prefix="/api/v1")
api_v1.include_router(events.router)
api_v1.include_router(defects.router)
api_v1.include_router(fleet.router)
api_v1.include_router(dashboard.router)
api_v1.include_router(insights.router)
api_v1.include_router(routes.router)
api_v1.include_router(simulator.router)
app.include_router(api_v1)
