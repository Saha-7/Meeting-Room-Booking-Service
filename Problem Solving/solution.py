def max_profit(n):
    # Building properties
    buildings = {
        "T": {"time": 5, "earn": 1500},
        "P": {"time": 4, "earn": 1000},
        "C": {"time": 10, "earn": 2000}
    }

    max_earning = 0
    best_plan = None

    # Try all combinations (small constraints → brute force is fine)
    for t in range(n // buildings["T"]["time"] + 1):
        for p in range(n // buildings["P"]["time"] + 1):
            for c in range(n // buildings["C"]["time"] + 1):

                total_time = (
                    t * buildings["T"]["time"] +
                    p * buildings["P"]["time"] +
                    c * buildings["C"]["time"]
                )

                if total_time > n:
                    continue

                remaining_time = n - total_time

                earning_rate = (
                    t * buildings["T"]["earn"] +
                    p * buildings["P"]["earn"] +
                    c * buildings["C"]["earn"]
                )

                total_earning = remaining_time * earning_rate

                if total_earning > max_earning:
                    max_earning = total_earning
                    best_plan = (t, p, c)

    return max_earning, best_plan




n = 7
earning, plan = max_profit(n)

print("Max Earnings:", earning)
print(f"T: {plan[0]}, P: {plan[1]}, C: {plan[2]}")