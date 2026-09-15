from fastapi import APIRouter

from app.db import congestion_collection, defects_collection, events_collection, fleet_collection
from app.models.schemas import SimulatorRunRequest, SimulatorRunResult
from app.services import simulator as simulator_service

router = APIRouter(tags=["simulator"])


@router.post("/simulator/run", response_model=SimulatorRunResult)
def run_simulator(payload: SimulatorRunRequest):
    """Defaults to the deterministic scripted demo scenario (P0-11).
    Pass scenario="random" for the legacy seeded-random run."""
    if payload.scenario == "random":
        return simulator_service.run_simulation(
            bus_count=payload.bus_count,
            events_per_bus=payload.events_per_bus,
            seed_confirmed_defect=payload.seed_confirmed_defect,
            seed=payload.seed,
        )
    return simulator_service.run_demo_scenario(
        with_evidence=payload.seed_evidence_images,
    )


@router.post("/simulator/reset", status_code=204)
def reset_demo_data():
    """Destructive: clears all simulated/demo data so the judge demo can be
    rerun predictably (PRD AC11). Display-ID counters reset too, so the next
    run starts again at EVT-0001 / DEF-0001. Routes are seed data, not demo
    state, and are intentionally preserved."""
    events_collection.delete_many({})
    defects_collection.delete_many({})
    congestion_collection.delete_many({})
    fleet_collection.delete_many({})
    from app.db import counters_collection

    counters_collection.delete_many({})
