import pandas as pd
from sklearn.linear_model import LogisticRegression
import joblib
from pathlib import Path


def load_csv(path: Path) -> pd.DataFrame:
    """Load a CSV file into a DataFrame."""
    return pd.read_csv(path)


def merge_datasets(train_df: pd.DataFrame, new_df: pd.DataFrame) -> pd.DataFrame:
    """Merge existing training data with new outcome data."""
    return pd.concat([train_df, new_df], ignore_index=True)


def preprocess(df: pd.DataFrame):
    """Preprocess the dataset for model training."""
    X = pd.get_dummies(df[['education_level', 'years_experience']])
    y = df['hired']
    return X, y


def train_model(X, y):
    """Train a logistic regression model."""
    model = LogisticRegression(solver='liblinear')
    model.fit(X, y)
    return model


def save_model(model, path: Path):
    joblib.dump(model, path)


def update_model(train_path: Path, outcome_path: Path, model_path: Path):
    train_df = load_csv(train_path)
    outcome_df = load_csv(outcome_path)
    combined = merge_datasets(train_df, outcome_df)

    X, y = preprocess(combined)
    model = train_model(X, y)

    save_model(model, model_path)
    combined.to_csv(train_path, index=False)


if __name__ == "__main__":
    base = Path(__file__).resolve().parent.parent / "data"
    train_file = base / "training_data.csv"
    outcome_file = base / "hiring_outcomes.csv"
    model_file = base / "model.pkl"
    update_model(train_file, outcome_file, model_file)
