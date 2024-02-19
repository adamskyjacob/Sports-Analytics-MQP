
from matplotlib import pyplot as plt
from visualizer import Visualizer

from sort import pick_sort

if __name__ == "__main__":
    vis = Visualizer("./images/")

    data = sorted(list(vis.per_pick_stat_pct.find()), key=pick_sort)
    
    for key in list(data[0].keys()):
        if key in ["_id", "pick"]:
            continue
    
        plt.gca().spines['left'].set_position('zero')
        plt.gca().spines['bottom'].set_position('zero')
        plt.gca().spines['top'].set_position('zero')
        plt.gca().spines['right'].set_position('zero')
    
        plt.gca().spines['top'].set_visible(False)
        plt.gca().spines['right'].set_visible(False)
        plt.xlim(0, 2500)
        
        vis.plot_stat([d[key] for d in data], title=key, filename=key)