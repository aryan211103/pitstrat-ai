from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class TireCompound(str, Enum):
    SOFT = "SOFT"
    MEDIUM = "MEDIUM"
    HARD = "HARD"
    INTERMEDIATE = "INTERMEDIATE"
    WET = "WET"
    UNKNOWN = "UNKNOWN"


class LapRecord(BaseModel):
    """One lap of data for one driver."""
    driver: str
    driver_number: int
    lap_number: int
    lap_time_seconds: Optional[float] = None   # None = outlap/inlap/DNF
    is_personal_best: bool = False
    compound: TireCompound
    tire_age_laps: int                          # how old the current set is
    stint_number: int
    position: Optional[int] = None
    gap_to_leader_seconds: Optional[float] = None
    sector1: Optional[float] = None
    sector2: Optional[float] = None
    sector3: Optional[float] = None
    is_pit_out_lap: bool = False
    is_pit_in_lap: bool = False
    # Track status fields (added for safety car awareness)
    is_safety_car: bool = False
    is_vsc: bool = False
    is_yellow_flag: bool = False
    is_red_flag: bool = False


class PitStop(BaseModel):
    """A single pit stop event."""
    driver: str
    driver_number: int
    lap_number: int
    pit_duration_seconds: Optional[float] = None
    compound_in: TireCompound   # compound fitted
    compound_out: TireCompound  # compound removed
    stint_number_after: int


class Stint(BaseModel):
    """One continuous tire stint for a driver."""
    driver: str
    driver_number: int
    stint_number: int
    compound: TireCompound
    lap_start: int
    lap_end: int
    total_laps: int
    avg_lap_time: Optional[float] = None
    degradation_rate: Optional[float] = None   # seconds lost per lap, filled by ML


class RaceSession(BaseModel):
    """Full parsed race session — the core data object."""
    year: int
    round_number: int
    race_name: str
    circuit: str
    total_laps: int
    laps: list[LapRecord]
    pit_stops: list[PitStop]
    stints: list[Stint]

    def laps_for_driver(self, driver: str) -> list[LapRecord]:
        return [l for l in self.laps if l.driver == driver]

    def stints_for_driver(self, driver: str) -> list[Stint]:
        return [s for s in self.stints if s.driver == driver]

    def pit_stops_for_driver(self, driver: str) -> list[PitStop]:
        return [p for p in self.pit_stops if p.driver == driver]

    @property
    def drivers(self) -> list[str]:
        return sorted(set(l.driver for l in self.laps))