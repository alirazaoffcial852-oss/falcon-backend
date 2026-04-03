-- Extend PhasePassengerStatus for driver actions (STILL_WAITING, MOVE_TO_NEXT).
ALTER TYPE "PhasePassengerStatus" ADD VALUE 'STILL_WAITING';
ALTER TYPE "PhasePassengerStatus" ADD VALUE 'MOVE_TO_NEXT';
