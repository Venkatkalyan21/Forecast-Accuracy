import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error

np.random.seed(42)

# 4. Dataset: Generate a synthetic time-series/regression dataset
days = np.arange(1, 366)
# True pattern: linear trend + seasonal sine wave + noise
trend = days * 0.5
seasonality = 50 * np.sin(days * 2 * np.pi / 30)
noise = np.random.normal(0, 15, size=len(days))
sales = trend + seasonality + noise + 200

data = pd.DataFrame({'Day': days, 'Sales': sales})
# Add some missing values to demonstrate preprocessing
data.loc[50:55, 'Sales'] = np.nan

# 5. Data Preprocessing
# Handle missing values by forward filling
data['Sales'] = data['Sales'].ffill()

# Feature selection: we will use Day and Day_of_month (to capture some seasonality)
data['Day_of_Month'] = data['Day'] % 30

X = data[['Day', 'Day_of_Month']]
y = data['Sales']

# Train-test split (80-20, sequential since it's time series-like)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, shuffle=False)

# 6. Model Building: Random Forest
model = RandomForestRegressor(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

# 7. Prediction
y_pred = model.predict(X_test)

# 8. Evaluation Metrics Calculation
def mean_absolute_percentage_error(y_true, y_pred): 
    y_true, y_pred = np.array(y_true), np.array(y_pred)
    return np.mean(np.abs((y_true - y_pred) / y_true)) * 100

mae = mean_absolute_error(y_test, y_pred)
rmse = np.sqrt(mean_squared_error(y_test, y_pred))
mape = mean_absolute_percentage_error(y_test, y_pred)

print(f"MAE: {mae:.2f}")
print(f"RMSE: {rmse:.2f}")
print(f"MAPE: {mape:.2f}%")

# 9. Visualization
# Plot 1: Actual vs Predicted
plt.figure(figsize=(12, 6))
plt.plot(y_train.index, y_train, label='Train Data', color='gray')
plt.plot(y_test.index, y_test, label='Actual Test Data', color='blue')
plt.plot(y_test.index, y_pred, label='Predicted Data', linestyle='dashed', color='red')
plt.title('Actual vs Predicted Sales using Random Forest')
plt.xlabel('Day')
plt.ylabel('Sales')
plt.legend()
plt.grid(True)
plt.savefig('actual_vs_predicted.png')
plt.close()

# Plot 2: Error Comparison
metrics = ['MAE', 'RMSE']
values = [mae, rmse]

plt.figure(figsize=(8, 5))
bars = plt.bar(metrics, values, color=['#4CAF50', '#F44336'])
plt.title('Error Metric Comparison (MAE vs RMSE)')
plt.ylabel('Error Value')
for bar in bars:
    yval = bar.get_height()
    plt.text(bar.get_x() + bar.get_width()/2, yval + 0.5, f'{yval:.2f}', ha='center', va='bottom')
plt.savefig('error_comparison.png')
plt.close()

# Print sample output for the report
output_df = pd.DataFrame({'Actual': y_test.values[:5], 'Predicted': y_pred[:5]})
print("\nSample Output (First 5 Days):")
print(output_df)
