
import sys
sys.path.insert(0, '.')
import pytest
pytest.main(['backend/tests/test_jobs.py::test_run_job_tracks_success_and_failed', '-v', '-s'])
