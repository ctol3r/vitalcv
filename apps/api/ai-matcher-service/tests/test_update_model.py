from pathlib import Path
import sys
import pandas as pd

sys.path.append(str(Path(__file__).resolve().parents[1] / "src"))
from update_model import update_model


def test_update_model(tmp_path: Path):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    train_file = data_dir / "training.csv"
    outcome_file = data_dir / "outcomes.csv"
    model_file = data_dir / "model.pkl"

    train_df = pd.DataFrame({
        "education_level": ["Bachelor", "Master"],
        "years_experience": [5, 3],
        "hired": [1, 0],
    })
    train_df.to_csv(train_file, index=False)

    outcome_df = pd.DataFrame({
        "education_level": ["PhD", "Bachelor"],
        "years_experience": [2, 7],
        "hired": [1, 0],
    })
    outcome_df.to_csv(outcome_file, index=False)

    update_model(train_file, outcome_file, model_file)

    updated = pd.read_csv(train_file)
    assert len(updated) == 4
    assert model_file.exists()
